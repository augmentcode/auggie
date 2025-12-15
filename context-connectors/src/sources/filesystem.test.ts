/**
 * Tests for FilesystemSource
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { FilesystemSource } from "./filesystem.js";

const TEST_DIR = "/tmp/context-connectors-test-fs-source";

describe("FilesystemSource", () => {
  beforeEach(async () => {
    // Create test directory structure
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(join(TEST_DIR, "src"), { recursive: true });
    await fs.mkdir(join(TEST_DIR, "node_modules/package"), { recursive: true });
    await fs.mkdir(join(TEST_DIR, ".git"), { recursive: true });

    // Create test files
    await fs.writeFile(join(TEST_DIR, "src/index.ts"), "export const foo = 1;");
    await fs.writeFile(join(TEST_DIR, "src/utils.ts"), "export function bar() {}");
    await fs.writeFile(join(TEST_DIR, "README.md"), "# Test Project");
    await fs.writeFile(join(TEST_DIR, "node_modules/package/index.js"), "module.exports = {}");
    await fs.writeFile(join(TEST_DIR, ".git/config"), "[core]");
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("fetchAll", () => {
    it("returns files from directory", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const files = await source.fetchAll();

      expect(files.length).toBeGreaterThan(0);
      const paths = files.map((f) => f.path);
      expect(paths).toContain("src/index.ts");
      expect(paths).toContain("src/utils.ts");
      expect(paths).toContain("README.md");
    });

    it("skips node_modules directory", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const files = await source.fetchAll();

      const paths = files.map((f) => f.path);
      expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
    });

    it("skips .git directory", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const files = await source.fetchAll();

      const paths = files.map((f) => f.path);
      expect(paths.some((p) => p.includes(".git"))).toBe(false);
    });

    it("respects .gitignore", async () => {
      // Create .gitignore
      await fs.writeFile(join(TEST_DIR, ".gitignore"), "*.log\n");
      await fs.writeFile(join(TEST_DIR, "debug.log"), "debug output");

      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const files = await source.fetchAll();

      const paths = files.map((f) => f.path);
      expect(paths).not.toContain("debug.log");
    });

    it("filters binary files", async () => {
      // Create a binary file
      await fs.writeFile(join(TEST_DIR, "binary.dat"), Buffer.from([0x80, 0x81, 0x82, 0xff]));

      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const files = await source.fetchAll();

      const paths = files.map((f) => f.path);
      expect(paths).not.toContain("binary.dat");
    });

    it("respects custom ignore patterns", async () => {
      await fs.writeFile(join(TEST_DIR, "temp.txt"), "temp content");

      const source = new FilesystemSource({
        rootPath: TEST_DIR,
        ignorePatterns: ["temp.txt"],
      });
      const files = await source.fetchAll();

      const paths = files.map((f) => f.path);
      expect(paths).not.toContain("temp.txt");
    });
  });

  describe("readFile", () => {
    it("returns file contents", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const contents = await source.readFile("src/index.ts");

      expect(contents).toBe("export const foo = 1;");
    });

    it("returns null for missing files", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const contents = await source.readFile("nonexistent.ts");

      expect(contents).toBeNull();
    });

    it("prevents path traversal", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const contents = await source.readFile("../../../etc/passwd");

      expect(contents).toBeNull();
    });
  });

  describe("getMetadata", () => {
    it("returns correct type and identifier", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const metadata = await source.getMetadata();

      expect(metadata.type).toBe("filesystem");
      expect(metadata.identifier).toBe(TEST_DIR);
      expect(metadata.syncedAt).toBeDefined();
    });
  });

  describe("fetchChanges", () => {
    it("returns null (not supported in Phase 2)", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const changes = await source.fetchChanges({
        type: "filesystem",
        identifier: TEST_DIR,
        syncedAt: new Date().toISOString(),
      });

      expect(changes).toBeNull();
    });
  });

  describe("listFiles", () => {
    it("returns list of file paths", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const files = await source.listFiles();

      expect(files).toBeInstanceOf(Array);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toHaveProperty("path");
      expect(files[0]).not.toHaveProperty("contents");
    });

    it("returns same files as fetchAll", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const listFilesResult = await source.listFiles();
      const fetchAllResult = await source.fetchAll();

      const listFilesPaths = listFilesResult.map((f) => f.path).sort();
      const fetchAllPaths = fetchAllResult.map((f) => f.path).sort();

      expect(listFilesPaths).toEqual(fetchAllPaths);
    });

    it("respects ignore rules", async () => {
      // Create .gitignore with a pattern
      await fs.writeFile(join(TEST_DIR, ".gitignore"), "*.log\n");
      await fs.writeFile(join(TEST_DIR, "debug.log"), "debug output");

      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const files = await source.listFiles();

      const paths = files.map((f) => f.path);
      expect(paths).not.toContain("debug.log");
    });

    it("skips node_modules and .git", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const files = await source.listFiles();

      const hasBadPaths = files.some(
        (f) => f.path.includes("node_modules") || f.path.includes(".git")
      );
      expect(hasBadPaths).toBe(false);
    });
  });
});

