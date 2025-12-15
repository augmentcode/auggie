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
export {};
//# sourceMappingURL=types.js.map