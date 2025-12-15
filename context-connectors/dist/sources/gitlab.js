/**
 * GitLab Source - Fetches files from GitLab repositories
 */
import { Readable } from "node:stream";
import ignoreFactory from "ignore";
import tar from "tar";
import { shouldFilterFile } from "../core/file-filter.js";
import { isoTimestamp } from "../core/utils.js";
// With NodeNext module resolution, we need to access the default export properly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ignore = ignoreFactory.default ?? ignoreFactory;
export class GitLabSource {
    type = "gitlab";
    baseUrl;
    projectId;
    encodedProjectId;
    ref;
    token;
    resolvedRef = null;
    constructor(config) {
        this.baseUrl = (config.baseUrl ?? "https://gitlab.com").replace(/\/$/, "");
        this.projectId = config.projectId;
        // URL-encode the project path for API calls
        this.encodedProjectId = encodeURIComponent(config.projectId);
        this.ref = config.ref ?? "HEAD";
        this.token = config.token ?? process.env.GITLAB_TOKEN ?? "";
        if (!this.token) {
            throw new Error("GitLab token required. Set GITLAB_TOKEN environment variable or pass token in config.");
        }
    }
    /**
     * Make an authenticated API request to GitLab
     */
    async apiRequest(path, options = {}) {
        const url = `${this.baseUrl}/api/v4${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                "PRIVATE-TOKEN": this.token,
                ...options.headers,
            },
        });
        if (!response.ok) {
            throw new Error(`GitLab API error: ${response.status} ${response.statusText} for ${path}`);
        }
        return response.json();
    }
    /**
     * Resolve ref (branch/tag/HEAD) to commit SHA
     */
    async resolveRefToSha() {
        if (this.resolvedRef) {
            return this.resolvedRef;
        }
        try {
            // Get the commit for the ref
            const data = await this.apiRequest(`/projects/${this.encodedProjectId}/repository/commits/${encodeURIComponent(this.ref)}`);
            this.resolvedRef = data.id;
            return data.id;
        }
        catch (error) {
            throw new Error(`Failed to resolve ref "${this.ref}" for ${this.projectId}: ${error}`);
        }
    }
    /**
     * Load ignore patterns from .gitignore and .augmentignore
     */
    async loadIgnorePatterns(ref) {
        const augmentignore = ignore();
        const gitignore = ignore();
        // Try to load .gitignore
        const gitignoreContent = await this.readFileRaw(".gitignore", ref);
        if (gitignoreContent) {
            gitignore.add(gitignoreContent);
        }
        // Try to load .augmentignore
        const augmentignoreContent = await this.readFileRaw(".augmentignore", ref);
        if (augmentignoreContent) {
            augmentignore.add(augmentignoreContent);
        }
        return { augmentignore, gitignore };
    }
    /**
     * Get raw file contents at a specific ref
     */
    async readFileRaw(path, ref) {
        try {
            const encodedPath = encodeURIComponent(path);
            const url = `${this.baseUrl}/api/v4/projects/${this.encodedProjectId}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(ref)}`;
            const response = await fetch(url, {
                headers: { "PRIVATE-TOKEN": this.token },
            });
            if (!response.ok) {
                return null;
            }
            return response.text();
        }
        catch {
            return null;
        }
    }
    /**
     * Download archive and extract files
     */
    async downloadArchive(ref) {
        console.log(`Downloading archive for ${this.projectId}@${ref}...`);
        const url = `${this.baseUrl}/api/v4/projects/${this.encodedProjectId}/repository/archive.tar.gz?sha=${encodeURIComponent(ref)}`;
        const response = await fetch(url, {
            headers: { "PRIVATE-TOKEN": this.token },
        });
        if (!response.ok) {
            throw new Error(`Failed to download archive: ${response.statusText}`);
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
                    // Remove the root directory prefix (e.g., "project-ref-sha/")
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
        console.log(`Extracted ${files.size} files from archive`);
        return files;
    }
    /**
     * Check if the push was a force push (base commit not reachable from head)
     */
    async isForcePush(base, head) {
        try {
            await this.apiRequest(`/projects/${this.encodedProjectId}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(head)}`);
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
        const data = await this.apiRequest(`/projects/${this.encodedProjectId}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(head)}`);
        const ignoreFiles = [".gitignore", ".augmentignore"];
        return (data.diffs || []).some((diff) => ignoreFiles.includes(diff.new_path));
    }
    async fetchAll() {
        const ref = await this.resolveRefToSha();
        const filesMap = await this.downloadArchive(ref);
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
        const data = await this.apiRequest(`/projects/${this.encodedProjectId}/repository/compare?from=${encodeURIComponent(previous.ref)}&to=${encodeURIComponent(currentRef)}`);
        const changedFiles = data.diffs || [];
        // If too many changes, do full reindex
        if (changedFiles.length > 100) {
            console.log(`Too many changes (${changedFiles.length}), triggering full re-index`);
            return null;
        }
        const added = [];
        const modified = [];
        const removed = [];
        for (const file of changedFiles) {
            if (file.deleted_file) {
                removed.push(file.old_path);
            }
            else {
                // Download file contents
                const contents = await this.readFileRaw(file.new_path, currentRef);
                if (contents !== null) {
                    const entry = { path: file.new_path, contents };
                    if (file.new_file) {
                        added.push(entry);
                    }
                    else {
                        modified.push(entry);
                    }
                }
                // Handle rename as remove + add
                if (file.renamed_file && file.old_path !== file.new_path) {
                    removed.push(file.old_path);
                }
            }
        }
        return { added, modified, removed };
    }
    async getMetadata() {
        const ref = await this.resolveRefToSha();
        return {
            type: "gitlab",
            identifier: this.projectId,
            ref,
            syncedAt: isoTimestamp(),
        };
    }
    async listFiles() {
        const sha = await this.resolveRefToSha();
        // Use recursive tree API
        const data = await this.apiRequest(`/projects/${this.encodedProjectId}/repository/tree?ref=${encodeURIComponent(sha)}&recursive=true&per_page=100`);
        return data
            .filter((item) => item.type === "blob")
            .map((item) => ({ path: item.path }));
    }
    async readFile(path) {
        const ref = await this.resolveRefToSha();
        return this.readFileRaw(path, ref);
    }
}
//# sourceMappingURL=gitlab.js.map