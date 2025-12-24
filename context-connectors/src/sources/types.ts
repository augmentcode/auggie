/**
 * Source interface and types for fetching files from data sources.
 *
 * A Source represents any data source that can be indexed:
 * - Filesystem (local directories)
 * - GitHub repositories
 * - GitLab repositories
 * - Websites
 *
 * Sources provide methods for both:
 * - **Indexing**: fetchAll, fetchChanges, getMetadata
 * - **Client operations**: listFiles, readFile
 *
 * @module sources/types
 */

import type { FileEntry, FileInfo, SourceMetadata } from "../core/types.js";

/**
 * Changes detected since the last sync, used for incremental indexing.
 *
 * When a source can determine what changed since the last sync,
 * it returns this structure. If incremental updates aren't possible
 * (e.g., force push, ignore file changes), the source returns null.
 *
 * @example
 * ```typescript
 * const changes = await source.fetchChanges(previousMetadata);
 * if (changes) {
 *   console.log(`${changes.added.length} added, ${changes.removed.length} removed`);
 * } else {
 *   console.log("Full re-index required");
 * }
 * ```
 */
export interface FileChanges {
  /** Files that were added since last sync (includes contents) */
  added: FileEntry[];
  /** Files that were modified since last sync (includes contents) */
  modified: FileEntry[];
  /** Paths of files that were removed since last sync */
  removed: string[];
}

/**
 * Source interface for fetching files from a data source.
 *
 * Implementations must provide methods for:
 * - **Full indexing**: `fetchAll()` to get all files
 * - **Incremental indexing**: `fetchChanges()` to get only what changed
 * - **Metadata**: `getMetadata()` to track source version
 * - **Client access**: `listFiles()` and `readFile()` for tools
 *
 * @example
 * ```typescript
 * // Create a source
 * const source = new FilesystemSource({ rootPath: "./my-project" });
 *
 * // For indexing
 * const files = await source.fetchAll();
 * const metadata = await source.getMetadata();
 *
 * // For client tools
 * const fileList = await source.listFiles();
 * const contents = await source.readFile("src/index.ts");
 * ```
 */
export interface Source {
  /** The type of this source (matches SourceMetadata.type) */
  readonly type: SourceMetadata["type"];

  // --- Methods for Indexing ---

  /**
   * Fetch all files from the source for a full index.
   *
   * This method is called when:
   * - Creating a new index
   * - Incremental update isn't possible
   * - Force re-index is requested
   *
   * Files are automatically filtered based on:
   * - .augmentignore patterns
   * - Built-in filters (binary files, large files, secrets)
   * - .gitignore patterns
   *
   * @returns Array of all indexable files with their contents
   */
  fetchAll(): Promise<FileEntry[]>;

  /**
   * Fetch changes since the last sync for incremental indexing.
   *
   * Returns null if incremental update isn't possible, which triggers
   * a full re-index. Common reasons for returning null:
   * - Force push detected
   * - Ignore files (.gitignore, .augmentignore) changed
   * - Too many changes to process efficiently
   * - Source doesn't support incremental updates
   *
   * @param previous - Metadata from the previous sync
   * @returns FileChanges if incremental possible, null otherwise
   */
  fetchChanges(previous: SourceMetadata): Promise<FileChanges | null>;

  /**
   * Get metadata about the current state of the source.
   *
   * This metadata is stored alongside the index and used for:
   * - Detecting changes for incremental updates
   * - Displaying source information to users
   * - Validating that a Source matches a stored index
   *
   * @returns Current source metadata including type, identifier, and ref
   */
  getMetadata(): Promise<SourceMetadata>;

  // --- Methods for Clients ---

  /**
   * List files and directories in a specific directory (non-recursive).
   *
   * Used by the `listFiles` tool to show available files and directories.
   * Returns only immediate children of the specified directory.
   * Agents can explore subdirectories by making multiple calls.
   *
   * @param directory - Directory path to list (default: root "")
   * @returns Array of file/directory info objects with paths and types
   */
  listFiles(directory?: string): Promise<FileInfo[]>;

  /**
   * Read a single file by path.
   *
   * Used by the `readFile` tool to fetch file contents on demand.
   * Returns null if the file doesn't exist or isn't readable.
   *
   * @param path - Relative path to the file
   * @returns File contents as string, or null if not found
   */
  readFile(path: string): Promise<string | null>;
}

