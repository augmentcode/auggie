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
 * // Default location: ~/.augment/context-connectors
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
import { homedir } from "node:os";
import { join } from "node:path";
import { sanitizeKey } from "../core/utils.js";
import type { IndexState } from "../core/types.js";
import type { IndexStore } from "./types.js";

/**
 * Configuration for FilesystemStore.
 */
export interface FilesystemStoreConfig {
  /**
   * Directory to store index files.
   * @default Platform-specific (see getDefaultStorePath)
   */
  basePath?: string;
}

/**
 * Get the default store path.
 *
 * Priority order:
 * 1. CONTEXT_CONNECTORS_STORE_PATH environment variable
 * 2. ~/.augment/context-connectors (unified across all platforms)
 *
 * This aligns with other Augment CLI state storage:
 * - ~/.augment/session.json - authentication
 * - ~/.augment/settings.json - user settings
 * - ~/.augment/rules/ - user rules
 * - ~/.augment/agents/ - user-defined agents
 * - ~/.augment/commands/ - custom commands
 */
function getDefaultStorePath(): string {
  // Environment variable takes precedence
  if (process.env.CONTEXT_CONNECTORS_STORE_PATH) {
    return process.env.CONTEXT_CONNECTORS_STORE_PATH;
  }

  // Default to ~/.augment/context-connectors for all platforms
  return join(homedir(), ".augment", "context-connectors");
}

/** Default base path for storing index files */
const DEFAULT_BASE_PATH = getDefaultStorePath();

/** State filename within each index directory (for incremental builds) */
const STATE_FILENAME = "state.json";

/** Search filename within each index directory (for search-only mode) */
const SEARCH_FILENAME = "search.json";

/**
 * Store implementation that persists to the local filesystem.
 *
 * Creates a directory structure:
 * ```
 * {basePath}/
 *   {key}/
 *     state.json     - Full state (for incremental builds)
 *     search.json    - Search index (same content for now, placeholder for future)
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
export class FilesystemStore implements IndexStore {
  private readonly basePath: string;

  /**
   * Create a new FilesystemStore.
   *
   * @param config - Optional configuration
   */
  constructor(config: FilesystemStoreConfig = {}) {
    this.basePath = config.basePath ?? DEFAULT_BASE_PATH;
  }

  /**
   * Get the path to the state file for a given key
   */
  private getStatePath(key: string): string {
    const sanitized = sanitizeKey(key);
    return join(this.basePath, sanitized, STATE_FILENAME);
  }

  /**
   * Get the path to the search file for a given key
   */
  private getSearchPath(key: string): string {
    const sanitized = sanitizeKey(key);
    return join(this.basePath, sanitized, SEARCH_FILENAME);
  }

  /**
   * Get the directory path for a given key
   */
  private getKeyDir(key: string): string {
    const sanitized = sanitizeKey(key);
    return join(this.basePath, sanitized);
  }

  /**
   * Load state from a specific file path (internal helper)
   */
  private async loadFromPath(filePath: string, validateBlobs: boolean): Promise<IndexState | null> {
    try {
      const data = await fs.readFile(filePath, "utf-8");
      const state = JSON.parse(data) as IndexState;

      // Validate that this is a full state file with blobs if required
      if (validateBlobs && !state.contextState.blobs) {
        throw new Error(
          `Invalid state file at "${filePath}": missing blobs field. ` +
          `This appears to be a search.json file. Use loadSearch() instead, or ` +
          `ensure state.json exists for incremental indexing operations.`
        );
      }

      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save state to a specific directory path (internal helper)
   */
  private async saveToPath(dirPath: string, state: IndexState): Promise<void> {
    const statePath = join(dirPath, STATE_FILENAME);
    const searchPath = join(dirPath, SEARCH_FILENAME);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Full state for incremental indexing (includes blobs with paths)
    const stateJson = JSON.stringify(state, null, 2);

    // Search-optimized state (strip blobs array, keep checkpointId, addedBlobs, deletedBlobs)
    const searchState: IndexState = {
      ...state,
      contextState: {
        ...state.contextState,
        blobs: [], // Strip blobs for search.json
      },
    };
    const searchJson = JSON.stringify(searchState, null, 2);

    // Write both files
    await Promise.all([
      fs.writeFile(statePath, stateJson, "utf-8"),
      fs.writeFile(searchPath, searchJson, "utf-8"),
    ]);
  }

  async loadState(key: string): Promise<IndexState | null> {
    const filePath = this.getStatePath(key);
    return this.loadFromPath(filePath, true);
  }

  async loadSearch(key: string): Promise<IndexState | null> {
    const filePath = this.getSearchPath(key);
    return this.loadFromPath(filePath, false);
  }

  async save(key: string, state: IndexState): Promise<void> {
    const keyDir = this.getKeyDir(key);
    await this.saveToPath(keyDir, state);
  }

  async delete(key: string): Promise<void> {
    const keyDir = this.getKeyDir(key);

    try {
      // Remove the entire directory (includes state.json and any other files)
      await fs.rm(keyDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async list(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      const keys: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check if this directory contains a state.json file
          const statePath = join(this.basePath, entry.name, STATE_FILENAME);
          try {
            await fs.access(statePath);
            keys.push(entry.name); // Return sanitized name
          } catch {
            // Directory doesn't contain a valid state, skip it
          }
        }
      }

      return keys;
    } catch (error) {
      // If basePath doesn't exist, return empty list
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
}

