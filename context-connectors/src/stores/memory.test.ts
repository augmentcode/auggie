/**
 * Tests for MemoryStore
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore } from "./memory.js";
import type { IndexState, IndexStateSearchOnly } from "../core/types.js";

describe("MemoryStore", () => {
  let store: MemoryStore;

  const createTestState = (
    id: string
  ): { full: IndexState; search: IndexStateSearchOnly } => {
    const source = {
      type: "filesystem" as const,
      config: { rootPath: `/test/${id}` },
      syncedAt: new Date().toISOString(),
    };
    return {
      full: {
        version: 1,
        contextState: {
          mode: "full" as const,
          checkpointId: `checkpoint-${id}`,
          addedBlobs: [],
          deletedBlobs: [],
          blobs: [],
        },
        source,
      },
      search: {
        version: 1,
        contextState: {
          mode: "search-only" as const,
          checkpointId: `checkpoint-${id}`,
          addedBlobs: [],
          deletedBlobs: [],
        },
        source,
      },
    };
  };

  beforeEach(() => {
    store = new MemoryStore();
  });

  describe("save and load", () => {
    it("should save and load state", async () => {
      const { full, search } = createTestState("1");
      await store.save("test-key", full, search);

      const loaded = await store.loadState("test-key");
      expect(loaded).toEqual(full);
    });

    it("should return null for non-existent key", async () => {
      const loaded = await store.loadState("non-existent");
      expect(loaded).toBeNull();
    });

    it("should overwrite existing state", async () => {
      const state1 = createTestState("1");
      const state2 = createTestState("2");

      await store.save("key", state1.full, state1.search);
      await store.save("key", state2.full, state2.search);

      const loaded = await store.loadState("key");
      expect(loaded).toEqual(state2.full);
    });

    it("should return deep copy on load", async () => {
      const { full, search } = createTestState("1");
      await store.save("key", full, search);

      const loaded = await store.loadState("key");
      if (loaded!.source.type === "filesystem") {
        loaded!.source.config.rootPath = "modified";
      }

      const loadedAgain = await store.loadState("key");
      if (loadedAgain!.source.type === "filesystem") {
        expect(loadedAgain!.source.config.rootPath).toBe("/test/1");
      }
    });

    it("should store deep copy on save", async () => {
      const { full, search } = createTestState("1");
      await store.save("key", full, search);

      if (full.source.type === "filesystem") {
        full.source.config.rootPath = "modified";
      }

      const loaded = await store.loadState("key");
      if (loaded!.source.type === "filesystem") {
        expect(loaded!.source.config.rootPath).toBe("/test/1");
      }
    });
  });

  describe("delete", () => {
    it("should delete existing key", async () => {
      const { full, search } = createTestState("1");
      await store.save("key", full, search);
      expect(store.has("key")).toBe(true);

      await store.delete("key");
      expect(store.has("key")).toBe(false);
    });

    it("should not throw for non-existent key", async () => {
      await expect(store.delete("non-existent")).resolves.not.toThrow();
    });
  });

  describe("list", () => {
    it("should return empty array when no keys", async () => {
      const keys = await store.list();
      expect(keys).toEqual([]);
    });

    it("should return all keys", async () => {
      const s1 = createTestState("1");
      const s2 = createTestState("2");
      const s3 = createTestState("3");
      await store.save("key1", s1.full, s1.search);
      await store.save("key2", s2.full, s2.search);
      await store.save("key3", s3.full, s3.search);

      const keys = await store.list();
      expect(keys.sort()).toEqual(["key1", "key2", "key3"]);
    });
  });

  describe("helper methods", () => {
    it("size should return number of stored keys", async () => {
      expect(store.size).toBe(0);

      const s1 = createTestState("1");
      await store.save("key1", s1.full, s1.search);
      expect(store.size).toBe(1);

      const s2 = createTestState("2");
      await store.save("key2", s2.full, s2.search);
      expect(store.size).toBe(2);
    });

    it("clear should remove all data", async () => {
      const s1 = createTestState("1");
      const s2 = createTestState("2");
      await store.save("key1", s1.full, s1.search);
      await store.save("key2", s2.full, s2.search);

      store.clear();
      expect(store.size).toBe(0);
      expect(await store.list()).toEqual([]);
    });

    it("has should check key existence", async () => {
      expect(store.has("key")).toBe(false);

      const { full, search } = createTestState("1");
      await store.save("key", full, search);
      expect(store.has("key")).toBe(true);
    });
  });
});

