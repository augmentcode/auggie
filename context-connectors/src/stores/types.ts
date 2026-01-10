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

import type { IndexState, IndexStateSearchOnly } from "../core/types.js";

/**
 * Read-only store interface for loading index state.
 *
 * Sufficient for SearchClient and other consumers that only
 * need to read existing indexes.
 *
 * @example
 * ```typescript
 * const store: IndexStoreReader = new FilesystemStore();
 * // For search operations, load the search-optimized file
 * const state = await store.loadSearch("my-project");
 * // For incremental indexing, load the full state
 * const fullState = await store.loadState("my-project");
 * const keys = await store.list();
 * ```
 */
export interface IndexStoreReader {
  /**
   * Load full index state for incremental indexing operations.
   *
   * Loads state.json which contains the complete DirectContextState
   * including the blobs array with file paths needed for incremental builds.
   *
   * @param key - The index key/name
   * @returns The stored IndexState with full blobs, or null if not found
   * @throws Error if the loaded state is missing the blobs field (e.g., search.json was loaded)
   */
  loadState(key: string): Promise<IndexState | null>;

  /**
   * Load search-optimized index state for search operations.
   *
   * Loads search.json which contains a minimal DirectContextState
   * with checkpointId, addedBlobs, and deletedBlobs, but without
   * the blobs array (which is only needed for incremental indexing).
   *
   * @param key - The index key/name
   * @returns The stored IndexStateSearchOnly (without blobs), or null if not found
   */
  loadSearch(key: string): Promise<IndexStateSearchOnly | null>;

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
 * // Indexer saves both full state and search-only state
 * await store.save("my-project", fullState, searchState);
 *
 * // Cleanup
 * await store.delete("old-project");
 * ```
 */
export interface IndexStore extends IndexStoreReader {
  /**
   * Save index state with the given key.
   *
   * Saves both full state (for incremental indexing) and search-only state
   * (for search operations). The search-only state is much smaller as it
   * excludes the blobs array.
   *
   * Overwrites any existing state with the same key.
   *
   * @param key - The index key/name
   * @param fullState - The full IndexState for incremental indexing
   * @param searchState - The search-only IndexState for search operations
   */
  save(
    key: string,
    fullState: IndexState,
    searchState: IndexStateSearchOnly
  ): Promise<void>;

  /**
   * Delete index state by key.
   *
   * No-op if the key doesn't exist.
   *
   * @param key - The index key/name to delete
   */
  delete(key: string): Promise<void>;
}

