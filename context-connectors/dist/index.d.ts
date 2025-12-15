/**
 * Context Connectors - Main package entry point
 *
 * Modular system for indexing any data source and making it
 * searchable via Augment's context engine.
 */
export * from "./core/index.js";
export * from "./sources/index.js";
export { FilesystemSource } from "./sources/filesystem.js";
export type { FilesystemSourceConfig } from "./sources/filesystem.js";
export * from "./stores/index.js";
export { FilesystemStore } from "./stores/filesystem.js";
export type { FilesystemStoreConfig } from "./stores/filesystem.js";
export { Indexer } from "./core/indexer.js";
export type { IndexerConfig } from "./core/indexer.js";
//# sourceMappingURL=index.d.ts.map