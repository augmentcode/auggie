/**
 * Memory Store - In-memory storage for testing and embedded use
 *
 * This store keeps all data in memory and is useful for:
 * - Unit testing without filesystem access
 * - Embedded usage where persistence is not needed
 * - Short-lived processes
 */

import type { IndexState } from "../core/types.js";
import type { IndexStore } from "./types.js";

/** Configuration for MemoryStore */
export interface MemoryStoreConfig {
  /** Optional initial data to populate the store */
  initialData?: Map<string, IndexState>;
}

export class MemoryStore implements IndexStore {
  private readonly data: Map<string, IndexState>;

  constructor(config: MemoryStoreConfig = {}) {
    this.data = config.initialData
      ? new Map(config.initialData)
      : new Map();
  }

  async loadState(key: string): Promise<IndexState | null> {
    const state = this.data.get(key);
    if (!state) return null;

    // Validate that this is a full state with blobs
    if (!state.contextState.blobs) {
      throw new Error(
        `Invalid state for key "${key}": missing blobs field. ` +
        `Use loadSearch() instead for search operations.`
      );
    }

    // Return a deep copy to prevent external mutation
    return JSON.parse(JSON.stringify(state));
  }

  async loadSearch(key: string): Promise<IndexState | null> {
    const state = this.data.get(key);
    // Return a deep copy to prevent external mutation
    // Note: MemoryStore stores full state, but loadSearch() can work with it
    return state ? JSON.parse(JSON.stringify(state)) : null;
  }

  async save(key: string, state: IndexState): Promise<void> {
    // Store a deep copy to prevent external mutation
    this.data.set(key, JSON.parse(JSON.stringify(state)));
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(): Promise<string[]> {
    return Array.from(this.data.keys());
  }

  /** Get the number of stored indexes (useful for testing) */
  get size(): number {
    return this.data.size;
  }

  /** Clear all stored data (useful for testing) */
  clear(): void {
    this.data.clear();
  }

  /** Check if a key exists (useful for testing) */
  has(key: string): boolean {
    return this.data.has(key);
  }
}

