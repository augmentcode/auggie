/**
 * Core shared types used throughout the Context Connectors system.
 *
 * These types define the fundamental data structures for:
 * - File entries and metadata
 * - Source information
 * - Index state persistence
 * - Indexing operation results
 *
 * @module core/types
 */

import type { DirectContextState } from "@augmentcode/auggie-sdk";

/**
 * A file with its contents, used for indexing operations.
 *
 * @example
 * ```typescript
 * const file: FileEntry = {
 *   path: "src/index.ts",
 *   contents: "export * from './core';"
 * };
 * ```
 */
export interface FileEntry {
  /** Relative path to the file from the source root */
  path: string;
  /** Full text contents of the file (UTF-8 encoded) */
  contents: string;
}

/**
 * File information returned by listFiles operations.
 * Contains path only (no contents) for efficiency.
 *
 * @example
 * ```typescript
 * const files: FileInfo[] = await source.listFiles();
 * console.log(files.map(f => f.path));
 * ```
 */
export interface FileInfo {
  /** Relative path to the file from the source root */
  path: string;
}

/**
 * Metadata about a data source, stored alongside the index state.
 *
 * Used to:
 * - Identify the source type and location
 * - Track the indexed version/ref for VCS sources
 * - Record when the index was last synced
 *
 * @example
 * ```typescript
 * const metadata: SourceMetadata = {
 *   type: "github",
 *   identifier: "microsoft/vscode",
 *   ref: "a1b2c3d4e5f6",
 *   syncedAt: "2024-01-15T10:30:00Z"
 * };
 * ```
 */
export interface SourceMetadata {
  /** The type of data source */
  type: "github" | "gitlab" | "website" | "filesystem";
  /**
   * Source-specific identifier:
   * - GitHub/GitLab: "owner/repo"
   * - Website: base URL
   * - Filesystem: absolute path
   */
  identifier: string;
  /** Git ref (commit SHA) for VCS sources. Used for incremental updates. */
  ref?: string;
  /** ISO 8601 timestamp of when the index was last synced */
  syncedAt: string;
}

/**
 * Complete index state that gets persisted to an IndexStore.
 *
 * Contains:
 * - The DirectContext state (embeddings, file index)
 * - Source metadata for tracking the indexed version
 *
 * @example
 * ```typescript
 * const state = await store.load("my-project");
 * if (state) {
 *   console.log(`Last synced: ${state.source.syncedAt}`);
 * }
 * ```
 */
export interface IndexState {
  /** The DirectContext state from auggie-sdk (embeddings, index data) */
  contextState: DirectContextState;
  /** Metadata about the source that was indexed */
  source: SourceMetadata;
}

/**
 * Result of an indexing operation.
 *
 * @example
 * ```typescript
 * const result = await indexer.index(source, store, "my-project");
 * console.log(`Indexed ${result.filesIndexed} files in ${result.duration}ms`);
 * ```
 */
export interface IndexResult {
  /**
   * Type of index operation performed:
   * - "full": Complete re-index of all files
   * - "incremental": Only changed files were updated
   * - "unchanged": No changes detected, index not modified
   */
  type: "full" | "incremental" | "unchanged";
  /** Number of files added or modified in the index */
  filesIndexed: number;
  /** Number of files removed from the index */
  filesRemoved: number;
  /** Total duration of the operation in milliseconds */
  duration: number;
}

