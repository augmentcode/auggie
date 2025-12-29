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
import { homedir, platform } from "node:os";
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
 * Get the default store path based on platform.
 *
 * Priority order:
 * 1. CONTEXT_CONNECTORS_STORE_PATH environment variable
 * 2. Platform-specific default:
 *    - Linux: ~/.local/share/context-connectors (or $XDG_DATA_HOME/context-connectors)
 *    - macOS: ~/Library/Application Support/context-connectors
 *    - Windows: %LOCALAPPDATA%\context-connectors
 */
function getDefaultStorePath(): string {
  // Environment variable takes precedence
  if (process.env.CONTEXT_CONNECTORS_STORE_PATH) {
    return process.env.CONTEXT_CONNECTORS_STORE_PATH;
  }

  const home = homedir();

  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "context-connectors");
    case "win32":
      return join(
        process.env.LOCALAPPDATA || join(home, "AppData", "Local"),
        "context-connectors"
      );
    default:
      // Linux and others: follow XDG Base Directory spec
      const xdgData =
        process.env.XDG_DATA_HOME || join(home, ".local", "share");
      return join(xdgData, "context-connectors");
  }
}

/** Default base path for storing index files */
const DEFAULT_BASE_PATH = getDefaultStorePath();

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
   * Get the directory path for a given key
   */
  private getKeyDir(key: string): string {
    const sanitized = sanitizeKey(key);
    return join(this.basePath, sanitized);
  }

  async load(key: string): Promise<IndexState | null> {
    const statePath = this.getStatePath(key);

    try {
      const data = await fs.readFile(statePath, "utf-8");
      return JSON.parse(data) as IndexState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async save(key: string, state: IndexState): Promise<void> {
    const keyDir = this.getKeyDir(key);
    const statePath = this.getStatePath(key);

    // Ensure directory exists
    await fs.mkdir(keyDir, { recursive: true });

    // Write state with pretty-printing for debuggability
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
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

