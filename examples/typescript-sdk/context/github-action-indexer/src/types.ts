/**
 * Types for the GitHub Action Indexer
 */

import type { DirectContextState } from "@augmentcode/auggie-sdk";

export type IndexState = {
  /** DirectContext state (checkpoint, blobs, etc.) */
  contextState: DirectContextState;

  /** Last indexed commit SHA (must be a full 40-character SHA, not a ref like "HEAD") */
  lastCommitSha: string;

  /** Repository information - used to verify we're indexing the same repository */
  repository: {
    owner: string;
    name: string;
  };
};

export type FileChange = {
  /** File path */
  path: string;

  /** Change status: added, modified, removed, renamed */
  status: "added" | "modified" | "removed" | "renamed";

  /** Previous filename (for renames) */
  previousFilename?: string;

  /** File contents (for added/modified files) */
  contents?: string;

  /** Blob name from previous index (for modified/removed files) */
  oldBlobName?: string;
};

export type IndexConfig = {
  /** Augment API token */
  apiToken: string;

  /**
   * Augment API URL
   * Can be provided via AUGMENT_API_URL env var, or extracted from
   * a JSON-formatted AUGMENT_API_TOKEN that includes tenantURL field
   */
  apiUrl: string;

  /** GitHub token */
  githubToken: string;

  /** Repository owner */
  owner: string;

  /** Repository name */
  repo: string;

  /** Branch to index */
  branch: string;

  /** Current commit SHA */
  currentCommit: string;

  /** Maximum commits before full re-index */
  maxCommits?: number;

  /** Maximum file changes before full re-index */
  maxFiles?: number;
};

export type IndexResult = {
  /** Whether indexing was successful */
  success: boolean;

  /** Type of indexing performed */
  type: "full" | "incremental" | "no-changes";

  /** Number of files indexed */
  filesIndexed: number;

  /** Number of files deleted */
  filesDeleted: number;

  /** New checkpoint ID */
  checkpointId: string;

  /** Commit SHA that was indexed */
  commitSha: string;

  /** Error message if failed */
  error?: string;

  /** Reason for full re-index (if applicable) */
  reindexReason?: string;
};
