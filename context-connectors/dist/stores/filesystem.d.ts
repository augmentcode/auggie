/**
 * Filesystem Store - Persists index state to local filesystem.
 *
 * Stores index state and DirectContext data to disk, enabling:
 * - Offline access to indexes
 * - Incremental updates (by preserving previous state)
 * - Sharing indexes between machines (by copying the directory)
 *
 * @module stores/filesystem
 *
 * @example
 * ```typescript
 * import { FilesystemStore } from "@augmentcode/context-connectors/stores";
 *
 * // Default location: .context-connectors
 * const store = new FilesystemStore();
 *
 * // Custom location
 * const customStore = new FilesystemStore({
 *   basePath: "/data/indexes",
 * });
 *
 * // Save an index
 * await store.save("my-project", state, contextData);
 *
 * // Load an index
 * const { state, contextData } = await store.load("my-project");
 * ```
 */
import type { IndexState } from "../core/types.js";
import type { IndexStore } from "./types.js";
/**
 * Configuration for FilesystemStore.
 */
export interface FilesystemStoreConfig {
    /**
     * Directory to store index files.
     * @default ".context-connectors"
     */
    basePath?: string;
}
/**
 * Store implementation that persists to the local filesystem.
 *
 * Creates a directory structure:
 * ```
 * {basePath}/
 *   {key}/
 *     state.json     - Index metadata and file list
 *     context.bin    - DirectContext binary data
 * ```
 *
 * @example
 * ```typescript
 * const store = new FilesystemStore({ basePath: "./indexes" });
 *
 * // Check if index exists
 * if (await store.exists("my-project")) {
 *   const { state, contextData } = await store.load("my-project");
 * }
 * ```
 */
export declare class FilesystemStore implements IndexStore {
    private readonly basePath;
    /**
     * Create a new FilesystemStore.
     *
     * @param config - Optional configuration
     */
    constructor(config?: FilesystemStoreConfig);
    /**
     * Get the path to the state file for a given key
     */
    private getStatePath;
    /**
     * Get the directory path for a given key
     */
    private getKeyDir;
    load(key: string): Promise<IndexState | null>;
    save(key: string, state: IndexState): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<string[]>;
}
//# sourceMappingURL=filesystem.d.ts.map