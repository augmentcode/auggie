/**
 * Tests for MemoryStore
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore } from "./memory.js";
import type { IndexState } from "../core/types.js";

describe("MemoryStore", () => {
  let store: MemoryStore;

  const createTestState = (id: string): IndexState => ({
    contextState: {
      checkpointId: `checkpoint-${id}`,
      addedBlobs: [],
      deletedBlobs: [],
      blobs: [],
    },
    source: {
      type: "filesystem",
      identifier: `/test/${id}`,
      syncedAt: new Date().toISOString(),
    },
  });

  beforeEach(() => {
    store = new MemoryStore();
  });

  describe("save and load", () => {
    it("should save and load state", async () => {
      const state = createTestState("1");
      await store.save("test-key", state);

      const loaded = await store.load("test-key");
      expect(loaded).toEqual(state);
    });

    it("should return null for non-existent key", async () => {
      const loaded = await store.load("non-existent");
      expect(loaded).toBeNull();
    });

    it("should overwrite existing state", async () => {
      const state1 = createTestState("1");
      const state2 = createTestState("2");

      await store.save("key", state1);
      await store.save("key", state2);

      const loaded = await store.load("key");
      expect(loaded).toEqual(state2);
    });

    it("should return deep copy on load", async () => {
      const state = createTestState("1");
      await store.save("key", state);

      const loaded = await store.load("key");
      loaded!.source.identifier = "modified";

      const loadedAgain = await store.load("key");
      expect(loadedAgain!.source.identifier).toBe("/test/1");
    });

    it("should store deep copy on save", async () => {
      const state = createTestState("1");
      await store.save("key", state);

      state.source.identifier = "modified";

      const loaded = await store.load("key");
      expect(loaded!.source.identifier).toBe("/test/1");
    });
  });

  describe("delete", () => {
    it("should delete existing key", async () => {
      const state = createTestState("1");
      await store.save("key", state);
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
      await store.save("key1", createTestState("1"));
      await store.save("key2", createTestState("2"));
      await store.save("key3", createTestState("3"));

      const keys = await store.list();
      expect(keys.sort()).toEqual(["key1", "key2", "key3"]);
    });
  });

  describe("helper methods", () => {
    it("size should return number of stored keys", async () => {
      expect(store.size).toBe(0);

      await store.save("key1", createTestState("1"));
      expect(store.size).toBe(1);

      await store.save("key2", createTestState("2"));
      expect(store.size).toBe(2);
    });

    it("clear should remove all data", async () => {
      await store.save("key1", createTestState("1"));
      await store.save("key2", createTestState("2"));

      store.clear();
      expect(store.size).toBe(0);
      expect(await store.list()).toEqual([]);
    });

    it("has should check key existence", async () => {
      expect(store.has("key")).toBe(false);

      await store.save("key", createTestState("1"));
      expect(store.has("key")).toBe(true);
    });
  });

  describe("initialization", () => {
    it("should accept initial data", async () => {
      const initialData = new Map<string, IndexState>();
      initialData.set("existing", createTestState("existing"));

      const storeWithData = new MemoryStore({ initialData });

      expect(storeWithData.has("existing")).toBe(true);
      const loaded = await storeWithData.load("existing");
      expect(loaded!.source.identifier).toBe("/test/existing");
    });
  });
});

