/**
 * Tests for FilesystemStore
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { FilesystemStore } from "./filesystem.js";
import type { IndexState } from "../core/types.js";

const TEST_DIR = "/tmp/context-connectors-test-fs-store";

// Create a minimal mock IndexState for testing
function createMockState(): IndexState {
  return {
    contextState: {
      checkpointId: "test-checkpoint-123",
      blobs: [],
    },
    source: {
      type: "filesystem",
      identifier: "/path/to/project",
      syncedAt: new Date().toISOString(),
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
      const state = createMockState();

      await store.save("my-project", state);

      // Verify file was created
      const statePath = join(TEST_DIR, "my-project", "state.json");
      const data = await fs.readFile(statePath, "utf-8");
      const savedState = JSON.parse(data);

      expect(savedState.contextState.checkpointId).toBe("test-checkpoint-123");
      expect(savedState.source.type).toBe("filesystem");
    });

    it("sanitizes key for filesystem safety", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const state = createMockState();

      await store.save("owner/repo@main", state);

      // Key should be sanitized
      const sanitizedKey = "owner_repo_main";
      const statePath = join(TEST_DIR, sanitizedKey, "state.json");
      await expect(fs.access(statePath)).resolves.toBeUndefined();
    });
  });

  describe("load", () => {
    it("returns saved state", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const originalState = createMockState();

      await store.save("test-key", originalState);
      const loadedState = await store.load("test-key");

      expect(loadedState).not.toBeNull();
      expect(loadedState!.contextState.checkpointId).toBe("test-checkpoint-123");
      expect(loadedState!.source.identifier).toBe("/path/to/project");
    });

    it("returns null for missing key", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const state = await store.load("nonexistent-key");

      expect(state).toBeNull();
    });

    it("returns null when basePath does not exist", async () => {
      const store = new FilesystemStore({ basePath: "/nonexistent/path" });
      const state = await store.load("some-key");

      expect(state).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes state", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const state = createMockState();

      await store.save("to-delete", state);
      expect(await store.load("to-delete")).not.toBeNull();

      await store.delete("to-delete");
      expect(await store.load("to-delete")).toBeNull();
    });

    it("does not throw for missing key", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      await expect(store.delete("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns saved keys", async () => {
      const store = new FilesystemStore({ basePath: TEST_DIR });
      const state = createMockState();

      await store.save("project-a", state);
      await store.save("project-b", state);
      await store.save("project-c", state);

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
      const state = createMockState();

      await store.save("valid-project", state);
      // Create an invalid directory without state.json
      await fs.mkdir(join(TEST_DIR, "invalid-project"), { recursive: true });

      const keys = await store.list();

      expect(keys).toContain("valid-project");
      expect(keys).not.toContain("invalid-project");
      expect(keys.length).toBe(1);
    });
  });
});

