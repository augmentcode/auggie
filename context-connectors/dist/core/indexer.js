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
import { promises as fs } from "node:fs";
import { DirectContext } from "@augmentcode/auggie-sdk";
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
    apiKey;
    apiUrl;
    /**
     * Create a new Indexer instance.
     *
     * @param config - Optional configuration (API credentials)
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey ?? process.env.AUGMENT_API_TOKEN;
        this.apiUrl = config.apiUrl ?? process.env.AUGMENT_API_URL;
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
    async index(source, store, key) {
        const startTime = Date.now();
        // Load previous state
        const previousState = await store.load(key);
        // If no previous state, do full index
        if (!previousState) {
            return this.fullIndex(source, store, key, startTime, "first_run");
        }
        // Try to get incremental changes
        const changes = await source.fetchChanges(previousState.source);
        // If source can't provide incremental changes, do full index
        if (changes === null) {
            return this.fullIndex(source, store, key, startTime, "incremental_not_supported");
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
     * Perform full re-index
     */
    async fullIndex(source, store, key, startTime, _reason) {
        // Create new DirectContext
        const context = await DirectContext.create({
            apiKey: this.apiKey,
            apiUrl: this.apiUrl,
        });
        // Fetch all files from source
        const files = await source.fetchAll();
        // Add files to index
        if (files.length > 0) {
            await context.addToIndex(files);
        }
        // Get source metadata
        const metadata = await source.getMetadata();
        // Export context state and save
        const contextState = context.export();
        const state = {
            contextState,
            source: metadata,
        };
        await store.save(key, state);
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
    async incrementalIndex(source, store, key, previousState, changes, startTime) {
        // Import previous context state via temp file
        const tempStateFile = `/tmp/context-connectors-${Date.now()}.json`;
        await fs.writeFile(tempStateFile, JSON.stringify(previousState.contextState, null, 2));
        let context;
        try {
            context = await DirectContext.importFromFile(tempStateFile, {
                apiKey: this.apiKey,
                apiUrl: this.apiUrl,
            });
        }
        finally {
            await fs.unlink(tempStateFile).catch(() => { }); // Clean up temp file
        }
        // Remove deleted files
        if (changes.removed.length > 0) {
            await context.removeFromIndex(changes.removed);
        }
        // Add new and modified files
        const filesToAdd = [...changes.added, ...changes.modified];
        if (filesToAdd.length > 0) {
            await context.addToIndex(filesToAdd);
        }
        // Get updated source metadata
        const metadata = await source.getMetadata();
        // Export and save updated state
        const contextState = context.export();
        const state = {
            contextState,
            source: metadata,
        };
        await store.save(key, state);
        return {
            type: "incremental",
            filesIndexed: filesToAdd.length,
            filesRemoved: changes.removed.length,
            duration: Date.now() - startTime,
        };
    }
}
//# sourceMappingURL=indexer.js.map