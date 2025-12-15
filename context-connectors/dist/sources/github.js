/**
 * GitHub Source - Fetches files from GitHub repositories.
 *
 * Features:
 * - Full indexing via tarball download
 * - Incremental updates via Compare API
 * - Force push detection (triggers full re-index)
 * - Respects .gitignore and .augmentignore
 * - Uses Git Trees API for efficient file listing
 *
 * @module sources/github
 *
 * @example
 * ```typescript
 * import { GitHubSource } from "@augmentcode/context-connectors/sources";
 *
 * const source = new GitHubSource({
 *   owner: "microsoft",
 *   repo: "vscode",
 *   ref: "main",
 * });
 *
 * // For indexing
 * const files = await source.fetchAll();
 *
 * // For clients
 * const fileList = await source.listFiles();
 * const contents = await source.readFile("package.json");
 * ```
 */
import { Readable } from "node:stream";
import ignoreFactory from "ignore";
import tar from "tar";
import { shouldFilterFile } from "../core/file-filter.js";
import { isoTimestamp } from "../core/utils.js";
// With NodeNext module resolution, we need to access the default export properly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ignore = ignoreFactory.default ?? ignoreFactory;
/**
 * Source implementation for GitHub repositories.
 *
 * Uses the GitHub API to:
 * - Download repository contents as tarball (for full index)
 * - Compare commits (for incremental updates)
 * - List files via Git Trees API (for file listing)
 * - Read individual files (for read_file tool)
 *
 * Requires @octokit/rest as a peer dependency.
 *
 * @example
 * ```typescript
 * const source = new GitHubSource({
 *   owner: "octocat",
 *   repo: "hello-world",
 *   ref: "main",
 * });
 *
 * // Resolve ref to commit SHA
 * const meta = await source.getMetadata();
 * console.log(`Indexing ${meta.identifier}@${meta.ref}`);
 * ```
 */
export class GitHubSource {
    type = "github";
    owner;
    repo;
    ref;
    token;
    octokit = null;
    resolvedRef = null;
    /**
     * Create a new GitHubSource.
     *
     * @param config - Source configuration
     * @throws Error if no GitHub token is available
     */
    constructor(config) {
        this.owner = config.owner;
        this.repo = config.repo;
        this.ref = config.ref ?? "HEAD";
        this.token = config.token ?? process.env.GITHUB_TOKEN ?? "";
        if (!this.token) {
            throw new Error("GitHub token required. Set GITHUB_TOKEN environment variable or pass token in config.");
        }
    }
    /**
     * Get or create Octokit instance (lazy loading for optional dependency)
     */
    async getOctokit() {
        if (this.octokit) {
            return this.octokit;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { Octokit } = (await import("@octokit/rest"));
            this.octokit = new Octokit({ auth: this.token });
            return this.octokit;
        }
        catch {
            throw new Error("GitHubSource requires @octokit/rest. Install it with: npm install @octokit/rest");
        }
    }
    /**
     * Resolve ref (branch/tag/HEAD) to commit SHA
     */
    async resolveRefToSha() {
        if (this.resolvedRef) {
            return this.resolvedRef;
        }
        const octokit = await this.getOctokit();
        try {
            const { data } = await octokit.repos.getCommit({
                owner: this.owner,
                repo: this.repo,
                ref: this.ref,
            });
            this.resolvedRef = data.sha;
            return data.sha;
        }
        catch (error) {
            throw new Error(`Failed to resolve ref "${this.ref}" for ${this.owner}/${this.repo}: ${error}`);
        }
    }
    /**
     * Load ignore patterns from .gitignore and .augmentignore
     */
    async loadIgnorePatterns(ref) {
        const augmentignore = ignore();
        const gitignore = ignore();
        // Try to load .gitignore
        try {
            const content = await this.getFileContents(".gitignore", ref);
            if (content) {
                gitignore.add(content);
            }
        }
        catch {
            // .gitignore doesn't exist
        }
        // Try to load .augmentignore
        try {
            const content = await this.getFileContents(".augmentignore", ref);
            if (content) {
                augmentignore.add(content);
            }
        }
        catch {
            // .augmentignore doesn't exist
        }
        return { augmentignore, gitignore };
    }
    /**
     * Get file contents at a specific ref
     */
    async getFileContents(path, ref) {
        const octokit = await this.getOctokit();
        try {
            const { data } = await octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path,
                ref,
            });
            if (Array.isArray(data) || data.type !== "file") {
                return null;
            }
            // Decode base64 content
            return Buffer.from(data.content, "base64").toString("utf-8");
        }
        catch {
            return null;
        }
    }
    /**
     * Download tarball and extract files
     */
    async downloadTarball(ref) {
        const octokit = await this.getOctokit();
        console.log(`Downloading tarball for ${this.owner}/${this.repo}@${ref}...`);
        // Get tarball URL
        const { url } = await octokit.repos.downloadTarballArchive({
            owner: this.owner,
            repo: this.repo,
            ref,
        });
        // Download tarball
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download tarball: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Load ignore patterns
        const { augmentignore, gitignore } = await this.loadIgnorePatterns(ref);
        // Extract files from tarball
        const files = new Map();
        const stream = Readable.from(buffer);
        await new Promise((resolve, reject) => {
            const parser = tar.list({
                onentry: (entry) => {
                    // Skip directories and symlinks
                    if (entry.type !== "File") {
                        return;
                    }
                    // Remove the root directory prefix (e.g., "owner-repo-sha/")
                    const pathParts = entry.path.split("/");
                    pathParts.shift(); // Remove first component
                    const filePath = pathParts.join("/");
                    // Read file contents
                    const chunks = [];
                    entry.on("data", (chunk) => chunks.push(chunk));
                    entry.on("end", () => {
                        const contentBuffer = Buffer.concat(chunks);
                        // Apply filtering in priority order:
                        // 1. .augmentignore
                        if (augmentignore.ignores(filePath)) {
                            return;
                        }
                        // 2. Path validation, file size, keyish patterns, UTF-8 validation
                        const filterResult = shouldFilterFile({
                            path: filePath,
                            content: contentBuffer,
                        });
                        if (filterResult.filtered) {
                            return;
                        }
                        // 3. .gitignore (checked last)
                        if (gitignore.ignores(filePath)) {
                            return;
                        }
                        // File passed all filters
                        const contents = contentBuffer.toString("utf-8");
                        files.set(filePath, contents);
                    });
                },
            });
            stream.pipe(parser);
            parser.on("close", resolve);
            stream.on("error", reject);
        });
        console.log(`Extracted ${files.size} files from tarball`);
        return files;
    }
    /**
     * Check if the push was a force push (base commit not reachable from head)
     */
    async isForcePush(base, head) {
        const octokit = await this.getOctokit();
        try {
            await octokit.repos.compareCommits({
                owner: this.owner,
                repo: this.repo,
                base,
                head,
            });
            return false;
        }
        catch {
            // If comparison fails, it's likely a force push
            return true;
        }
    }
    /**
     * Check if ignore files changed between commits
     */
    async ignoreFilesChanged(base, head) {
        const octokit = await this.getOctokit();
        const { data } = await octokit.repos.compareCommits({
            owner: this.owner,
            repo: this.repo,
            base,
            head,
        });
        const ignoreFiles = [".gitignore", ".augmentignore"];
        return (data.files || []).some((file) => ignoreFiles.includes(file.filename));
    }
    async fetchAll() {
        const ref = await this.resolveRefToSha();
        const filesMap = await this.downloadTarball(ref);
        const files = [];
        for (const [path, contents] of filesMap) {
            files.push({ path, contents });
        }
        return files;
    }
    async fetchChanges(previous) {
        // Need previous ref to compute changes
        if (!previous.ref) {
            return null;
        }
        const currentRef = await this.resolveRefToSha();
        // Same commit, no changes
        if (previous.ref === currentRef) {
            return { added: [], modified: [], removed: [] };
        }
        // Check for force push
        if (await this.isForcePush(previous.ref, currentRef)) {
            console.log("Force push detected, triggering full re-index");
            return null;
        }
        // Check if ignore files changed
        if (await this.ignoreFilesChanged(previous.ref, currentRef)) {
            console.log("Ignore files changed, triggering full re-index");
            return null;
        }
        // Get changed files via compare API
        const octokit = await this.getOctokit();
        const { data } = await octokit.repos.compareCommits({
            owner: this.owner,
            repo: this.repo,
            base: previous.ref,
            head: currentRef,
        });
        const changedFiles = data.files || [];
        // If too many changes, do full reindex
        if (changedFiles.length > 100) {
            console.log(`Too many changes (${changedFiles.length}), triggering full re-index`);
            return null;
        }
        const added = [];
        const modified = [];
        const removed = [];
        for (const file of changedFiles) {
            if (file.status === "removed") {
                removed.push(file.filename);
            }
            else if (file.status === "added" || file.status === "modified" || file.status === "renamed") {
                // Download file contents
                const contents = await this.getFileContents(file.filename, currentRef);
                if (contents !== null) {
                    const entry = { path: file.filename, contents };
                    if (file.status === "added") {
                        added.push(entry);
                    }
                    else {
                        modified.push(entry);
                    }
                }
                // Handle rename as remove + add
                if (file.status === "renamed" && file.previous_filename) {
                    removed.push(file.previous_filename);
                }
            }
        }
        return { added, modified, removed };
    }
    async getMetadata() {
        const ref = await this.resolveRefToSha();
        return {
            type: "github",
            identifier: `${this.owner}/${this.repo}`,
            ref,
            syncedAt: isoTimestamp(),
        };
    }
    async listFiles() {
        // Use Git Trees API for efficiency (no need to download tarball)
        const octokit = await this.getOctokit();
        const sha = await this.resolveRefToSha();
        const { data } = await octokit.git.getTree({
            owner: this.owner,
            repo: this.repo,
            tree_sha: sha,
            recursive: "true",
        });
        return data.tree
            .filter((item) => item.type === "blob")
            .map((item) => ({ path: item.path }));
    }
    async readFile(path) {
        const ref = await this.resolveRefToSha();
        return this.getFileContents(path, ref);
    }
}
//# sourceMappingURL=github.js.map