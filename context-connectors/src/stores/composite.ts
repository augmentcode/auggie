/**
 * Composite store that combines multiple index sources.
 *
 * Routes index lookups to the appropriate underlying store based on
 * parsed index specifications.
 *
 * @module stores/composite
 */

import type { IndexStoreReader } from "./types.js";
import type { IndexState } from "../core/types.js";
import type { IndexSpec } from "./index-spec.js";
import { FilesystemStore } from "./filesystem.js";
import { getS3Config } from "./s3-config.js";

/**
 * Entry mapping a display name to its store and key.
 */
interface StoreEntry {
  /** Display name for this index */
  displayName: string;
  /** The store to load from */
  store: IndexStoreReader;
  /** The key to use when loading from the store */
  key: string;
}

/**
 * Composite store reader that combines multiple index sources.
 *
 * This allows the MCP server to serve indexes from different locations:
 * - Named indexes from the default store
 * - Direct filesystem paths
 * - S3 URLs
 *
 * @example
 * ```typescript
 * const specs = parseIndexSpecs(["my-project", "path:/data/other", "s3://bucket/idx"]);
 * const composite = await CompositeStoreReader.fromSpecs(specs);
 *
 * const names = await composite.list();
 * const state = await composite.loadSearch("my-project");
 * ```
 */
export class CompositeStoreReader implements IndexStoreReader {
  private entries: Map<string, StoreEntry>;

  private constructor(entries: StoreEntry[]) {
    this.entries = new Map(entries.map((e) => [e.displayName, e]));
  }

  /**
   * Create a composite store from parsed index specs.
   *
   * @param specs - Parsed index specifications
   * @returns CompositeStoreReader instance
   */
  static async fromSpecs(specs: IndexSpec[]): Promise<CompositeStoreReader> {
    const entries: StoreEntry[] = [];

    // Lazily create stores as needed
    let defaultStore: FilesystemStore | null = null;
    let s3Store: IndexStoreReader | null = null;

    for (const spec of specs) {
      let store: IndexStoreReader;
      let key: string;

      switch (spec.type) {
        case "name":
          // Use the default filesystem store (~/.augment/context-connectors)
          if (!defaultStore) {
            defaultStore = new FilesystemStore();
          }
          store = defaultStore;
          key = spec.value;
          break;

        case "path":
          // Create a filesystem store pointing directly at the path
          // Use "." as key to load from the path directly
          store = new FilesystemStore({ basePath: spec.value });
          key = ".";
          break;

        case "s3": {
          // Parse S3 URL: s3://bucket/prefix/path
          const url = spec.value;
          const pathPart = url.slice(5); // Remove "s3://"
          const slashIdx = pathPart.indexOf("/");
          if (slashIdx === -1) {
            throw new Error(`Invalid S3 URL "${url}": missing path after bucket`);
          }
          const bucket = pathPart.slice(0, slashIdx);
          const keyPath = pathPart.slice(slashIdx + 1);

          // Get base S3 config from environment, override bucket and prefix
          const baseConfig = getS3Config();
          const { S3Store } = await import("./s3.js");

          // Extract the "index key" (last component) and prefix (everything before)
          const lastSlash = keyPath.lastIndexOf("/");
          if (lastSlash === -1) {
            // Just bucket/indexName
            store = new S3Store({ ...baseConfig, bucket, prefix: "" });
            key = keyPath;
          } else {
            // bucket/prefix/indexName
            const prefix = keyPath.slice(0, lastSlash + 1);
            key = keyPath.slice(lastSlash + 1);
            store = new S3Store({ ...baseConfig, bucket, prefix });
          }
          break;
        }
      }

      entries.push({ displayName: spec.displayName, store, key });
    }

    return new CompositeStoreReader(entries);
  }

  async loadState(displayName: string): Promise<IndexState | null> {
    const entry = this.entries.get(displayName);
    if (!entry) {
      return null;
    }
    return entry.store.loadState(entry.key);
  }

  async loadSearch(displayName: string): Promise<IndexState | null> {
    const entry = this.entries.get(displayName);
    if (!entry) {
      return null;
    }
    return entry.store.loadSearch(entry.key);
  }

  async list(): Promise<string[]> {
    return Array.from(this.entries.keys());
  }
}

