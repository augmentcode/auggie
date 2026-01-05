/**
 * Tests for FilesystemStore
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { FilesystemStore } from "./filesystem.js";
import type { IndexState, IndexStateSearchOnly } from "../core/types.js";

const TEST_DIR = "/tmp/context-connectors-test-fs-store";

// Create a minimal mock IndexState for testing
function createMockState(): { full: IndexState; search: IndexStateSearchOnly } {
  const source = {
    type: "filesystem" as const,
    config: { rootPath: "/path/to/project" },
    syncedAt: new Date().toISOString(),
  };
  return {
    full: {
      version: 1,
      contextState: {
        mode: "full" as const,
        checkpointId: "test-checkpoint-123",
        addedBlobs: ["blob-1", "blob-2"],
        deletedBlobs: [],
        blobs: [
          ["blob-1", "src/file1.ts"],
          ["blob-2", "src/file2.ts"],
        ],
      },
      source,
    },
    search: {
      version: 1,
      contextState: {
        mode: "search-only" as const,
        checkpointId: "test-checkpoint-123",
        addedBlobs: ["blob-1", "blob-2"],
        deletedBlobs: [],
      },
      source,
    },
  };
}

describe("FilesystemStore", () => {
  beforeEach(async () => {
    // Clean up test directory before each test
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Clean up test directory after each test
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("save", () => {
    it("creates directory and file", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const { full, search } = createMockState();

      await store.save("my-project", full, search);

      // Verify file was created in indexes subdirectory
      const statePath = join(TEST_DIR, "indexes", "my-project", "state.json");
      const data = await fs.readFile(statePath, "utf-8");
      const savedState = JSON.parse(data);

      expect(savedState.contextState.checkpointId).toBe("test-checkpoint-123");
      expect(savedState.source.type).toBe("filesystem");
    });

    it("sanitizes key for filesystem safety", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const { full, search } = createMockState();

      await store.save("owner/repo@main", full, search);

      // Key should be sanitized and stored in indexes subdirectory
      const sanitizedKey = "owner_repo_main";
      const statePath = join(TEST_DIR, "indexes", sanitizedKey, "state.json");
      await expect(fs.access(statePath)).resolves.toBeUndefined();
    });
  });

  describe("loadState", () => {
    it("returns saved state with blobs", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const { full, search } = createMockState();

      await store.save("test-key", full, search);
      const loadedState = await store.loadState("test-key");

      expect(loadedState).not.toBeNull();
      expect(loadedState!.contextState.checkpointId).toBe("test-checkpoint-123");
      expect(loadedState!.contextState.blobs).toBeDefined();
      expect(loadedState!.contextState.blobs.length).toBeGreaterThan(0);
      if (loadedState!.source.type === "filesystem") {
        expect(loadedState!.source.config.rootPath).toBe("/path/to/project");
      }
    });

    it("returns null for missing key", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const state = await store.loadState("nonexistent-key");

      expect(state).toBeNull();
    });

    it("returns null when basePath does not exist", async () => {
      const store = new FilesystemStore({ basePath: "/nonexistent/path" });
      const state = await store.loadState("some-key");

      expect(state).toBeNull();
    });
  });

  describe("loadSearch", () => {
    it("returns saved state without blobs", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const { full, search } = createMockState();

      await store.save("search-test", full, search);
      const searchLoaded = await store.loadSearch("search-test");

      expect(searchLoaded).not.toBeNull();
      expect(searchLoaded!.contextState.checkpointId).toBe("test-checkpoint-123");
      // search.json should not have blobs property
      expect("blobs" in searchLoaded!.contextState).toBe(false);
      // But should have addedBlobs and deletedBlobs
      expect(searchLoaded!.contextState.addedBlobs).toBeDefined();
      expect(searchLoaded!.contextState.deletedBlobs).toBeDefined();
    });

    it("returns null for missing key", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const state = await store.loadSearch("nonexistent-key");

      expect(state).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes state", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const { full, search } = createMockState();

      await store.save("to-delete", full, search);
      expect(await store.loadState("to-delete")).not.toBeNull();

      await store.delete("to-delete");
      expect(await store.loadState("to-delete")).toBeNull();
    });

    it("does not throw for missing key", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      await expect(store.delete("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns saved keys", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const { full, search } = createMockState();

      await store.save("project-a", full, search);
      await store.save("project-b", full, search);
      await store.save("project-c", full, search);

      const keys = await store.list();

      expect(keys).toContain("project-a");
      expect(keys).toContain("project-b");
      expect(keys).toContain("project-c");
      expect(keys.length).toBe(3);
    });

    it("returns empty array when basePath does not exist", async () => {
      const store = new FilesystemStore({ basePath: "/nonexistent/path" });
      const keys = await store.list();

      expect(keys).toEqual([]);
    });

    it("ignores directories without state.json", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const { full, search } = createMockState();

      await store.save("valid-project", full, search);
      // Create an invalid directory without state.json
      await fs.mkdir(join(TEST_DIR, "invalid-project"), { recursive: true });

      const keys = await store.list();

      expect(keys).toContain("valid-project");
      expect(keys).not.toContain("invalid-project");
      expect(keys.length).toBe(1);
    });
  });
});

