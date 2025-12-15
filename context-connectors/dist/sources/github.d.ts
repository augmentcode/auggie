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
import type { FileEntry, FileInfo, SourceMetadata } from "../core/types.js";
import type { FileChanges, Source } from "./types.js";
/**
 * Configuration for GitHubSource.
 */
export interface GitHubSourceConfig {
    /**
     * GitHub API token for authentication.
     * Required for private repos and to avoid rate limits.
     * @default process.env.GITHUB_TOKEN
     */
    token?: string;
    /** Repository owner (user or organization) */
    owner: string;
    /** Repository name */
    repo: string;
    /**
     * Git ref (branch, tag, or commit SHA).
     * @default "HEAD"
     */
    ref?: string;
}
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
export declare class GitHubSource implements Source {
    readonly type: "github";
    private readonly owner;
    private readonly repo;
    private readonly ref;
    private readonly token;
    private octokit;
    private resolvedRef;
    /**
     * Create a new GitHubSource.
     *
     * @param config - Source configuration
     * @throws Error if no GitHub token is available
     */
    constructor(config: GitHubSourceConfig);
    /**
     * Get or create Octokit instance (lazy loading for optional dependency)
     */
    private getOctokit;
    /**
     * Resolve ref (branch/tag/HEAD) to commit SHA
     */
    private resolveRefToSha;
    /**
     * Load ignore patterns from .gitignore and .augmentignore
     */
    private loadIgnorePatterns;
    /**
     * Get file contents at a specific ref
     */
    private getFileContents;
    /**
     * Download tarball and extract files
     */
    private downloadTarball;
    /**
     * Check if the push was a force push (base commit not reachable from head)
     */
    private isForcePush;
    /**
     * Check if ignore files changed between commits
     */
    private ignoreFilesChanged;
    fetchAll(): Promise<FileEntry[]>;
    fetchChanges(previous: SourceMetadata): Promise<FileChanges | null>;
    getMetadata(): Promise<SourceMetadata>;
    listFiles(): Promise<FileInfo[]>;
    readFile(path: string): Promise<string | null>;
}
//# sourceMappingURL=github.d.ts.map