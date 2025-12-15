/**
 * Memory Store - In-memory storage for testing and embedded use
 *
 * This store keeps all data in memory and is useful for:
 * - Unit testing without filesystem access
 * - Embedded usage where persistence is not needed
 * - Short-lived processes
 */
export class MemoryStore {
    data;
    constructor(config = {}) {
        this.data = config.initialData
            ? new Map(config.initialData)
            : new Map();
    }
    async load(key) {
        const state = this.data.get(key);
        // Return a deep copy to prevent external mutation
        return state ? JSON.parse(JSON.stringify(state)) : null;
    }
    async save(key, state) {
        // Store a deep copy to prevent external mutation
        this.data.set(key, JSON.parse(JSON.stringify(state)));
    }
    async delete(key) {
        this.data.delete(key);
    }
    async list() {
        return Array.from(this.data.keys());
    }
    /** Get the number of stored indexes (useful for testing) */
    get size() {
        return this.data.size;
    }
    /** Clear all stored data (useful for testing) */
    clear() {
        this.data.clear();
    }
    /** Check if a key exists (useful for testing) */
    has(key) {
        return this.data.has(key);
    }
}
//# sourceMappingURL=memory.js.map