/**
 * Filesystem Source - Fetches files from the local filesystem.
 *
 * Indexes files from a local directory with automatic filtering:
 * - Respects .gitignore and .augmentignore patterns
 * - Filters binary files, large files, and secrets
 * - Skips common non-code directories (node_modules, .git, etc.)
 *
 * @module sources/filesystem
 *
 * @example
 * ```typescript
 * import { FilesystemSource } from "@augmentcode/context-connectors/sources";
 *
 * const source = new FilesystemSource({
 *   rootPath: "./my-project",
 *   ignorePatterns: ["*.log", "tmp/"],
 * });
 *
 * // For indexing
 * const files = await source.fetchAll();
 *
 * // For clients
 * const fileList = await source.listFiles();
 * const contents = await source.readFile("src/index.ts");
 * ```
 */
import type { FileEntry, FileInfo, SourceMetadata } from "../core/types.js";
import type { FileChanges, Source } from "./types.js";
/**
 * Configuration for FilesystemSource.
 */
export interface FilesystemSourceConfig {
    /** Root directory to index (can be relative or absolute) */
    rootPath: string;
    /**
     * Additional patterns to ignore.
     * Added on top of .gitignore/.augmentignore patterns.
     */
    ignorePatterns?: string[];
}
/**
 * Source implementation for local filesystem directories.
 *
 * Walks the directory tree, applying filters in this order:
 * 1. Skip default directories (.git, node_modules, etc.)
 * 2. Apply .augmentignore patterns (highest priority)
 * 3. Apply built-in filters (binary, large files, secrets)
 * 4. Apply .gitignore patterns (lowest priority)
 *
 * @example
 * ```typescript
 * const source = new FilesystemSource({ rootPath: "./my-project" });
 *
 * // Get all indexable files
 * const files = await source.fetchAll();
 * console.log(`Found ${files.length} files`);
 *
 * // Read a specific file
 * const content = await source.readFile("package.json");
 * ```
 */
export declare class FilesystemSource implements Source {
    readonly type: "filesystem";
    private readonly rootPath;
    private readonly ignorePatterns;
    /**
     * Create a new FilesystemSource.
     *
     * @param config - Source configuration
     */
    constructor(config: FilesystemSourceConfig);
    /**
     * Load ignore rules from .gitignore and .augmentignore files
     */
    private loadIgnoreRules;
    /**
     * Recursively walk directory and collect files
     */
    private walkDirectory;
    fetchAll(): Promise<FileEntry[]>;
    listFiles(): Promise<FileInfo[]>;
    fetchChanges(_previous: SourceMetadata): Promise<FileChanges | null>;
    getMetadata(): Promise<SourceMetadata>;
    readFile(path: string): Promise<string | null>;
}
//# sourceMappingURL=filesystem.d.ts.map