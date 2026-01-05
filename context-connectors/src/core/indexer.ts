/**
 * Indexer - Main orchestrator for indexing operations.
 *
 * The Indexer connects Sources to Stores, handling:
 * - Full indexing (first run or forced)
 * - Incremental indexing (only changed files)
 * - DirectContext creation and management
 *
 * @module core/indexer
 *
 * @example
 * ```typescript
 * import { Indexer } from "@augmentcode/context-connectors";
 * import { FilesystemSource } from "@augmentcode/context-connectors/sources";
 * import { FilesystemStore } from "@augmentcode/context-connectors/stores";
 *
 * const source = new FilesystemSource({ rootPath: "./my-project" });
 * const store = new FilesystemStore();
 * const indexer = new Indexer();
 *
 * const result = await indexer.index(source, store, "my-project");
 * console.log(`Indexed ${result.filesIndexed} files`);
 * ```
 */

import { DirectContext } from "@augmentcode/auggie-sdk";
import type {
  FullContextState,
  SearchOnlyContextState,
  IndexingProgress,
  IndexingResult,
} from "@augmentcode/auggie-sdk";
import type {
  FileEntry,
  IndexResult,
  IndexState,
  IndexStateSearchOnly,
} from "./types.js";
import type { FileChanges, Source } from "../sources/types.js";
import type { IndexStore } from "../stores/types.js";

/**
 * Configuration options for the Indexer.
 */
export interface IndexerConfig {
  /**
   * Augment API key for DirectContext operations.
   * @default process.env.AUGMENT_API_TOKEN
   */
  apiKey?: string;
  /**
   * Augment API URL.
   * @default process.env.AUGMENT_API_URL
   */
  apiUrl?: string;
}

/**
 * Main indexer class that orchestrates indexing operations.
 *
 * The Indexer:
 * 1. Fetches files from a Source
 * 2. Creates/updates a DirectContext index
 * 3. Persists the result to a Store
 *
 * @example
 * ```typescript
 * const indexer = new Indexer({
 *   apiKey: "your-api-key",
 *   apiUrl: "https://api.augmentcode.com/",
 * });
 *
 * // First run: full index
 * const result1 = await indexer.index(source, store, "my-project");
 * // result1.type === "full"
 *
 * // Subsequent run: incremental if possible
 * const result2 = await indexer.index(source, store, "my-project");
 * // result2.type === "incremental" or "unchanged"
 * ```
 */
export class Indexer {
  private readonly apiKey?: string;
  private readonly apiUrl?: string;

  /**
   * Create a new Indexer instance.
   *
   * @param config - Optional configuration (API credentials)
   */
  constructor(config: IndexerConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.AUGMENT_API_TOKEN;
    this.apiUrl = config.apiUrl ?? process.env.AUGMENT_API_URL;
  }

  /**
   * Add files to index with progress reporting.
   * Returns the indexing result with counts of newly uploaded vs already cached files.
   */
  private async addToIndex(context: DirectContext, files: FileEntry[]): Promise<IndexingResult> {
    console.log(`Indexing ${files.length} files...`);
    const result = await context.addToIndex(files, {
      onProgress: (progress: IndexingProgress) => {
        const elapsed = Math.round((Date.now() - progress.startedAt.getTime()) / 1000);
        if (progress.stage === "uploading") {
          const bytes = progress.bytesUploaded ?? 0;
          const kb = Math.round(bytes / 1024);
          console.log(`  [${elapsed}s] Uploaded: ${progress.uploaded}/${progress.total}, Indexed: ${progress.indexed}/${progress.total} (${kb} KB)`);
        } else if (progress.stage === "indexing") {
          console.log(`  [${elapsed}s] Uploaded: ${progress.uploaded}/${progress.total}, Indexed: ${progress.indexed}/${progress.total}`);
        } else if (progress.stage === "checkpointing") {
          console.log(`  [${elapsed}s] Checkpointing...`);
        }
      },
    });

    // Log summary of what was indexed
    if (result.alreadyUploaded.length > 0) {
      console.log(`  ${result.alreadyUploaded.length} files unchanged (skipped)`);
    }
    if (result.newlyUploaded.length > 0) {
      console.log(`  ${result.newlyUploaded.length} new files uploaded and indexed`);
    }

    return result;
  }

  /**
   * Index a source and save the result to a store.
   *
   * This is the main entry point for indexing. It automatically:
   * - Does a full index if no previous state exists
   * - Attempts incremental update if previous state exists
   * - Falls back to full index if incremental isn't possible
   *
   * @param source - The data source to index
   * @param store - The store to save the index to
   * @param key - Unique key/name for this index
   * @returns Result containing type, files indexed/removed, and duration
   *
   * @example
   * ```typescript
   * const result = await indexer.index(source, store, "my-project");
   * if (result.type === "unchanged") {
   *   console.log("No changes detected");
   * } else {
   *   console.log(`${result.type}: ${result.filesIndexed} files`);
   * }
   * ```
   */
  async index(source: Source, store: IndexStore, key: string): Promise<IndexResult> {
    const startTime = Date.now();

    // Load previous state for incremental indexing
    const previousState = await store.loadState(key);

    // If no previous state, do full index
    if (!previousState) {
      return this.fullIndex(source, store, key, startTime, null);
    }

    // Try to get incremental changes
    const changes = await source.fetchChanges(previousState.source);

    // If source can't provide incremental changes, do a full refresh
    // but reuse the previous context state for client-side deduplication
    if (changes === null) {
      return this.fullIndex(source, store, key, startTime, previousState);
    }

    // Check if there are any changes
    if (changes.added.length === 0 && changes.modified.length === 0 && changes.removed.length === 0) {
      return {
        type: "unchanged",
        filesIndexed: 0,
        filesRemoved: 0,
        duration: Date.now() - startTime,
      };
    }

    // Perform incremental update
    return this.incrementalIndex(source, store, key, previousState, changes, startTime);
  }

  /**
   * Perform full re-index.
   *
   * If previousState is provided, imports it to benefit from client-side
   * deduplication (skipping unchanged files without server round-trip).
   */
  private async fullIndex(
    source: Source,
    store: IndexStore,
    key: string,
    startTime: number,
    previousState: IndexState | null
  ): Promise<IndexResult> {
    // Import previous context if available (for client-side deduplication),
    // otherwise create a new one
    const context = previousState
      ? await DirectContext.import(previousState.contextState, {
          apiKey: this.apiKey,
          apiUrl: this.apiUrl,
        })
      : await DirectContext.create({
          apiKey: this.apiKey,
          apiUrl: this.apiUrl,
        });

    // Fetch all files from source
    const files = await source.fetchAll();

    // Add files to index
    if (files.length > 0) {
      await this.addToIndex(context, files);
    }

    // Get source metadata
    const metadata = await source.getMetadata();

    // Export both full and search-only states
    const fullContextState = context.export({
      mode: "full",
    }) as FullContextState;
    const searchContextState = context.export({
      mode: "search-only",
    }) as SearchOnlyContextState;

    const fullState: IndexState = {
      version: 1,
      contextState: fullContextState,
      source: metadata,
    };
    const searchState: IndexStateSearchOnly = {
      version: 1,
      contextState: searchContextState,
      source: metadata,
    };

    await store.save(key, fullState, searchState);

    return {
      type: "full",
      filesIndexed: files.length,
      filesRemoved: 0,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Perform incremental update
   */
  private async incrementalIndex(
    source: Source,
    store: IndexStore,
    key: string,
    previousState: IndexState,
    changes: FileChanges,
    startTime: number
  ): Promise<IndexResult> {
    // Import previous context state
    const context = await DirectContext.import(previousState.contextState, {
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
    });

    // Remove deleted files
    if (changes.removed.length > 0) {
      console.log(`Removing ${changes.removed.length} files from index...`);
      await context.removeFromIndex(changes.removed);
    }

    // Add new and modified files
    const filesToAdd: FileEntry[] = [...changes.added, ...changes.modified];
    if (filesToAdd.length > 0) {
      await this.addToIndex(context, filesToAdd);
    }

    // Get updated source metadata
    const metadata = await source.getMetadata();

    // Export both full and search-only states
    const fullContextState = context.export({
      mode: "full",
    }) as FullContextState;
    const searchContextState = context.export({
      mode: "search-only",
    }) as SearchOnlyContextState;

    const fullState: IndexState = {
      version: 1,
      contextState: fullContextState,
      source: metadata,
    };
    const searchState: IndexStateSearchOnly = {
      version: 1,
      contextState: searchContextState,
      source: metadata,
    };

    await store.save(key, fullState, searchState);

    return {
      type: "incremental",
      filesIndexed: filesToAdd.length,
      filesRemoved: changes.removed.length,
      duration: Date.now() - startTime,
    };
  }
}

