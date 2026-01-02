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
 * Contains path and type (no contents) for efficiency.
 *
 * @example
 * ```typescript
 * const entries: FileInfo[] = await source.listFiles();
 * const dirs = entries.filter(e => e.type === "directory");
 * const files = entries.filter(e => e.type === "file");
 * ```
 */
export interface FileInfo {
  /** Relative path to the file or directory from the source root */
  path: string;
  /** Whether this entry is a file or directory */
  type: "file" | "directory";
}

/**
 * Source-specific configuration types (without secrets).
 * These are stored alongside the index to enable re-indexing.
 */

/** GitHub source config (without token) */
export interface GitHubSourceStoredConfig {
  owner: string;
  repo: string;
  ref?: string;
}

/** GitLab source config (without token) */
export interface GitLabSourceStoredConfig {
  projectId: string;
  baseUrl?: string;
  ref?: string;
}

/** BitBucket source config (without token) */
export interface BitBucketSourceStoredConfig {
  workspace: string;
  repo: string;
  baseUrl?: string;
  ref?: string;
}

/** Website source config */
export interface WebsiteSourceStoredConfig {
  url: string;
  maxDepth?: number;
  maxPages?: number;
  includePaths?: string[];
  excludePaths?: string[];
  respectRobotsTxt?: boolean;
  userAgent?: string;
  delayMs?: number;
}

/** Filesystem source config */
export interface FilesystemSourceStoredConfig {
  rootPath: string;
  ignorePatterns?: string[];
}

/**
 * Metadata about a data source, stored alongside the index state.
 * Uses a discriminated union to store source-specific configuration.
 *
 * Used to:
 * - Identify the source type and location
 * - Store configuration for re-indexing
 * - Track the resolved version for VCS sources
 * - Record when the index was last synced
 */
export type SourceMetadata =
  | {
      type: "github";
      config: GitHubSourceStoredConfig;
      /** Resolved commit SHA that was indexed */
      resolvedRef?: string;
      /** ISO 8601 timestamp of when the index was last synced */
      syncedAt: string;
    }
  | {
      type: "gitlab";
      config: GitLabSourceStoredConfig;
      resolvedRef?: string;
      syncedAt: string;
    }
  | {
      type: "bitbucket";
      config: BitBucketSourceStoredConfig;
      resolvedRef?: string;
      syncedAt: string;
    }
  | {
      type: "website";
      config: WebsiteSourceStoredConfig;
      syncedAt: string;
    }
  | {
      type: "filesystem";
      config: FilesystemSourceStoredConfig;
      syncedAt: string;
    };

/** Helper type to extract source type */
export type SourceType = SourceMetadata["type"];

/**
 * Legacy source metadata format (for backward compatibility).
 * Old indexes stored identifier directly instead of config.
 */
interface LegacySourceMetadata {
  type: string;
  identifier: string;
  ref?: string;
  syncedAt: string;
}

/** Check if metadata is in legacy format */
function isLegacyFormat(
  meta: SourceMetadata | LegacySourceMetadata
): meta is LegacySourceMetadata {
  return "identifier" in meta && !("config" in meta);
}

/**
 * Get a human-readable identifier from source metadata.
 * Returns owner/repo for VCS, URL for website, path for filesystem.
 * Handles both new and legacy formats for backward compatibility.
 */
export function getSourceIdentifier(
  meta: SourceMetadata | LegacySourceMetadata
): string {
  // Handle legacy format
  if (isLegacyFormat(meta)) {
    return meta.identifier;
  }

  switch (meta.type) {
    case "github":
      return `${meta.config.owner}/${meta.config.repo}`;
    case "gitlab":
      return meta.config.projectId;
    case "bitbucket":
      return `${meta.config.workspace}/${meta.config.repo}`;
    case "website":
      return new URL(meta.config.url).hostname;
    case "filesystem":
      return meta.config.rootPath;
  }
}

/**
 * Get the resolved ref (commit SHA) from source metadata.
 * Returns undefined for sources without versioning.
 * Handles both new and legacy formats for backward compatibility.
 */
export function getResolvedRef(
  meta: SourceMetadata | LegacySourceMetadata
): string | undefined {
  // Handle legacy format
  if (isLegacyFormat(meta)) {
    return meta.ref;
  }

  if ("resolvedRef" in meta) {
    return meta.resolvedRef;
  }
  return undefined;
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

