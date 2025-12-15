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
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { sanitizeKey } from "../core/utils.js";
/** Default base path for storing index files */
const DEFAULT_BASE_PATH = ".context-connectors";
/** State filename within each index directory */
const STATE_FILENAME = "state.json";
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
export class FilesystemStore {
    basePath;
    /**
     * Create a new FilesystemStore.
     *
     * @param config - Optional configuration
     */
    constructor(config = {}) {
        this.basePath = config.basePath ?? DEFAULT_BASE_PATH;
    }
    /**
     * Get the path to the state file for a given key
     */
    getStatePath(key) {
        const sanitized = sanitizeKey(key);
        return join(this.basePath, sanitized, STATE_FILENAME);
    }
    /**
     * Get the directory path for a given key
     */
    getKeyDir(key) {
        const sanitized = sanitizeKey(key);
        return join(this.basePath, sanitized);
    }
    async load(key) {
        const statePath = this.getStatePath(key);
        try {
            const data = await fs.readFile(statePath, "utf-8");
            return JSON.parse(data);
        }
        catch (error) {
            if (error.code === "ENOENT") {
                return null;
            }
            throw error;
        }
    }
    async save(key, state) {
        const keyDir = this.getKeyDir(key);
        const statePath = this.getStatePath(key);
        // Ensure directory exists
        await fs.mkdir(keyDir, { recursive: true });
        // Write state with pretty-printing for debuggability
        await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
    }
    async delete(key) {
        const keyDir = this.getKeyDir(key);
        try {
            // Remove the entire directory (includes state.json and any other files)
            await fs.rm(keyDir, { recursive: true, force: true });
        }
        catch (error) {
            // Ignore if directory doesn't exist
            if (error.code !== "ENOENT") {
                throw error;
            }
        }
    }
    async list() {
        try {
            const entries = await fs.readdir(this.basePath, { withFileTypes: true });
            const keys = [];
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Check if this directory contains a state.json file
                    const statePath = join(this.basePath, entry.name, STATE_FILENAME);
                    try {
                        await fs.access(statePath);
                        keys.push(entry.name); // Return sanitized name
                    }
                    catch {
                        // Directory doesn't contain a valid state, skip it
                    }
                }
            }
            return keys;
        }
        catch (error) {
            // If basePath doesn't exist, return empty list
            if (error.code === "ENOENT") {
                return [];
            }
            throw error;
        }
    }
}
//# sourceMappingURL=filesystem.js.map