/**
 * Memory Store - In-memory storage for testing and embedded use
 *
 * This store keeps all data in memory and is useful for:
 * - Unit testing without filesystem access
 * - Embedded usage where persistence is not needed
 * - Short-lived processes
 */

import type { IndexState, IndexStateSearchOnly } from "../core/types.js";
import type { IndexStore } from "./types.js";

/** Stored data for each index */
interface StoredIndex {
  fullState: IndexState;
  searchState: IndexStateSearchOnly;
}

/** Configuration for MemoryStore */
export interface MemoryStoreConfig {
  /** Optional initial data to populate the store */
  initialData?: Map<string, StoredIndex>;
}

export class MemoryStore implements IndexStore {
  private readonly data: Map<string, StoredIndex>;

  constructor(config: MemoryStoreConfig = {}) {
    this.data = config.initialData ? new Map(config.initialData) : new Map();
  }

  async loadState(key: string): Promise<IndexState | null> {
    const stored = this.data.get(key);
    if (!stored) return null;

    // Return a deep copy to prevent external mutation
    return JSON.parse(JSON.stringify(stored.fullState));
  }

  async loadSearch(key: string): Promise<IndexStateSearchOnly | null> {
    const stored = this.data.get(key);
    if (!stored) return null;

    // Return a deep copy to prevent external mutation
    return JSON.parse(JSON.stringify(stored.searchState));
  }

  async save(
    key: string,
    fullState: IndexState,
    searchState: IndexStateSearchOnly
  ): Promise<void> {
    // Store deep copies to prevent external mutation
    this.data.set(key, {
      fullState: JSON.parse(JSON.stringify(fullState)),
      searchState: JSON.parse(JSON.stringify(searchState)),
    });
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

