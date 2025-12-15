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
export declare class MemoryStore implements IndexStore {
    private readonly data;
    constructor(config?: MemoryStoreConfig);
    load(key: string): Promise<IndexState | null>;
    save(key: string, state: IndexState): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<string[]>;
    /** Get the number of stored indexes (useful for testing) */
    get size(): number;
    /** Clear all stored data (useful for testing) */
    clear(): void;
    /** Check if a key exists (useful for testing) */
    has(key: string): boolean;
}
//# sourceMappingURL=memory.d.ts.map