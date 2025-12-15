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
import type { IndexResult } from "./types.js";
import type { Source } from "../sources/types.js";
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
export declare class Indexer {
    private readonly apiKey?;
    private readonly apiUrl?;
    /**
     * Create a new Indexer instance.
     *
     * @param config - Optional configuration (API credentials)
     */
    constructor(config?: IndexerConfig);
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
    index(source: Source, store: IndexStore, key: string): Promise<IndexResult>;
    /**
     * Perform full re-index
     */
    private fullIndex;
    /**
     * Perform incremental update
     */
    private incrementalIndex;
}
//# sourceMappingURL=indexer.d.ts.map