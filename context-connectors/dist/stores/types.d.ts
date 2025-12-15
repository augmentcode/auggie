/**
 * Store interfaces for persisting index state.
 *
 * Stores provide persistence for indexed data:
 * - **IndexStoreReader**: Read-only access (for clients)
 * - **IndexStore**: Full read/write access (for indexer)
 *
 * Available implementations:
 * - `FilesystemStore`: Local file storage
 * - `S3Store`: AWS S3 and compatible services
 * - `MemoryStore`: In-memory storage (for testing)
 *
 * @module stores/types
 */
import type { IndexState } from "../core/types.js";
/**
 * Read-only store interface for loading index state.
 *
 * Sufficient for SearchClient and other consumers that only
 * need to read existing indexes.
 *
 * @example
 * ```typescript
 * const store: IndexStoreReader = new FilesystemStore();
 * const state = await store.load("my-project");
 * const keys = await store.list();
 * ```
 */
export interface IndexStoreReader {
    /**
     * Load index state by key.
     *
     * @param key - The index key/name
     * @returns The stored IndexState, or null if not found
     */
    load(key: string): Promise<IndexState | null>;
    /**
     * List all available index keys.
     *
     * @returns Array of index keys that can be loaded
     */
    list(): Promise<string[]>;
}
/**
 * Full store interface for reading and writing index state.
 *
 * Required by the Indexer for creating and updating indexes.
 * Extends IndexStoreReader with save and delete operations.
 *
 * @example
 * ```typescript
 * const store: IndexStore = new FilesystemStore();
 *
 * // Indexer uses full interface
 * await store.save("my-project", indexState);
 *
 * // Cleanup
 * await store.delete("old-project");
 * ```
 */
export interface IndexStore extends IndexStoreReader {
    /**
     * Save index state with the given key.
     *
     * Overwrites any existing state with the same key.
     *
     * @param key - The index key/name
     * @param state - The IndexState to persist
     */
    save(key: string, state: IndexState): Promise<void>;
    /**
     * Delete index state by key.
     *
     * No-op if the key doesn't exist.
     *
     * @param key - The index key/name to delete
     */
    delete(key: string): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map