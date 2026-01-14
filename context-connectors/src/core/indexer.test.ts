/**
 * Tests for Indexer
 *
 * Note: Integration tests that use DirectContext require AUGMENT_API_TOKEN
 * and AUGMENT_API_URL environment variables to be set.
 *
 * These tests depend on @augmentcode/auggie-sdk being properly installed.
 * If the SDK fails to load, tests will be skipped.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { Source } from "../sources/types.js";
import type { SourceMetadata } from "./types.js";

// Try to import SDK-dependent modules
let Indexer: typeof import("./indexer.js").Indexer;
let FilesystemStore: typeof import("../stores/filesystem.js").FilesystemStore;
let sdkLoadError: Error | null = null;

try {
  // These imports will fail if SDK is not properly installed
  const indexerMod = await import("./indexer.js");
  const storeMod = await import("../stores/filesystem.js");
  Indexer = indexerMod.Indexer;
  FilesystemStore = storeMod.FilesystemStore;
} catch (e) {
  sdkLoadError = e as Error;
}

const TEST_SOURCE_DIR = "/tmp/context-connectors-test-indexer-source";
const TEST_STORE_DIR = "/tmp/context-connectors-test-indexer-store";

// Check if API credentials are available for integration tests
// Note: AUGMENT_API_URL must be a valid URL (not "null" or empty)
const hasApiCredentials = !!(
  process.env.AUGMENT_API_TOKEN &&
  process.env.AUGMENT_API_URL &&
  process.env.AUGMENT_API_URL !== "null" &&
  process.env.AUGMENT_API_URL.startsWith("http")
);

/**
 * Create a mock source that reads files from a directory.
 * Used for integration tests since FilesystemSource was removed.
 */
function createMockSource(rootPath: string): Source {
  const metadata: SourceMetadata = {
    type: "github",
    config: { owner: "test-owner", repo: "test-repo" },
    syncedAt: new Date().toISOString(),
  };

  return {
    type: "github",
    async fetchAll() {
      const files: Array<{ path: string; contents: string }> = [];
      async function walk(dir: string, prefix: string = "") {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await walk(fullPath, relativePath);
          } else if (entry.isFile()) {
            const contents = await fs.readFile(fullPath, "utf-8");
            files.push({ path: relativePath, contents });
          }
        }
      }
      await walk(rootPath);
      return files;
    },
    async fetchChanges() {
      return null;
    },
    async getMetadata() {
      return metadata;
    },
    async listFiles() {
      return [];
    },
    async readFile() {
      return null;
    },
  };
}

// Skip all tests if SDK failed to load
describe.skipIf(sdkLoadError !== null)("Indexer", () => {
  beforeEach(async () => {
    // Create test directories
    await fs.mkdir(TEST_SOURCE_DIR, { recursive: true });
    await fs.mkdir(join(TEST_SOURCE_DIR, "src"), { recursive: true });

    // Create test files
    await fs.writeFile(
      join(TEST_SOURCE_DIR, "src/index.ts"),
      "export const hello = 'world';"
    );
    await fs.writeFile(
      join(TEST_SOURCE_DIR, "README.md"),
      "# Test Project\nThis is a test."
    );
  });

  afterEach(async () => {
    // Clean up test directories
    await fs.rm(TEST_SOURCE_DIR, { recursive: true, force: true });
    await fs.rm(TEST_STORE_DIR, { recursive: true, force: true });
  });

  describe("Indexer configuration", () => {
    it("creates with default config", () => {
      const indexer = new Indexer();
      expect(indexer).toBeDefined();
    });

    it("creates with custom config", () => {
      const indexer = new Indexer({
        apiKey: "test-key",
        apiUrl: "https://api.test.com",
      });
      expect(indexer).toBeDefined();
    });
  });

  describe.skipIf(!hasApiCredentials)("Integration tests (require API credentials)", () => {
    it("performs full index end-to-end", async () => {
      const source = createMockSource(TEST_SOURCE_DIR);
      const store = new FilesystemStore({ basePath: TEST_STORE_DIR });
      const indexer = new Indexer();

      const result = await indexer.index(source, store, "test-project");

      expect(result.type).toBe("full");
      expect(result.filesIndexed).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);

      // Verify state was saved
      const state = await store.loadState("test-project");
      expect(state).not.toBeNull();
      expect(state!.source.type).toBe("github");
      expect(state!.contextState).toBeDefined();
    });

    it("returns unchanged when re-indexing same content", async () => {
      const source = createMockSource(TEST_SOURCE_DIR);
      const store = new FilesystemStore({ basePath: TEST_STORE_DIR });
      const indexer = new Indexer();

      // First index
      const result1 = await indexer.index(source, store, "test-project");
      expect(result1.type).toBe("full");

      // Second index - should still be full since fetchChanges returns null
      // (incremental not supported in Phase 2)
      const result2 = await indexer.index(source, store, "test-project");
      expect(result2.type).toBe("full");
    });

    it("correctly handles empty directory", async () => {
      const emptyDir = "/tmp/context-connectors-test-empty";
      await fs.mkdir(emptyDir, { recursive: true });

      try {
        const source = createMockSource(emptyDir);
        const store = new FilesystemStore({ basePath: TEST_STORE_DIR });
        const indexer = new Indexer();

        const result = await indexer.index(source, store, "empty-project");

        expect(result.type).toBe("full");
        expect(result.filesIndexed).toBe(0);
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe("Unit tests (no API required)", () => {
    it("mock source can be passed to index method signature", async () => {
      const source = createMockSource(TEST_SOURCE_DIR);
      const store = new FilesystemStore({ basePath: TEST_STORE_DIR });
      const indexer = new Indexer();

      // Just verify the types work together - don't actually call index without API
      expect(source.type).toBe("github");
      expect(typeof indexer.index).toBe("function");
      expect(typeof store.save).toBe("function");
    });

    it("source fetchAll returns expected files", async () => {
      const source = createMockSource(TEST_SOURCE_DIR);
      const files = await source.fetchAll();

      expect(files.length).toBe(2);
      const paths = files.map((f) => f.path);
      expect(paths).toContain("src/index.ts");
      expect(paths).toContain("README.md");
    });
  });
});

