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
    it("returns correct type and config", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const metadata = await source.getMetadata();

      expect(metadata.type).toBe("filesystem");
      if (metadata.type === "filesystem") {
        expect(metadata.config.rootPath).toBe(TEST_DIR);
      }
      expect(metadata.syncedAt).toBeDefined();
    });
  });

  describe("fetchChanges", () => {
    it("returns null (not supported in Phase 2)", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const changes = await source.fetchChanges({
        type: "filesystem",
        config: { rootPath: TEST_DIR },
        syncedAt: new Date().toISOString(),
      });

      expect(changes).toBeNull();
    });
  });

  describe("listFiles", () => {
    it("returns list of file and directory entries", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const entries = await source.listFiles();

      expect(entries).toBeInstanceOf(Array);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0]).toHaveProperty("path");
      expect(entries[0]).toHaveProperty("type");
      expect(["file", "directory"]).toContain(entries[0].type);
    });

    it("returns only immediate children of root (non-recursive)", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const entries = await source.listFiles();

      // Should include src directory but NOT src/index.ts
      const paths = entries.map((e) => e.path);
      expect(paths).toContain("src");
      expect(paths).not.toContain("src/index.ts");
      expect(paths).not.toContain("src/utils.ts");
    });

    it("correctly identifies files and directories", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const entries = await source.listFiles();

      const srcEntry = entries.find((e) => e.path === "src");
      expect(srcEntry?.type).toBe("directory");

      const readmeEntry = entries.find((e) => e.path === "README.md");
      expect(readmeEntry?.type).toBe("file");
    });

    it("lists contents of subdirectory when directory parameter is provided", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const entries = await source.listFiles("src");

      const paths = entries.map((e) => e.path);
      expect(paths).toContain("src/index.ts");
      expect(paths).toContain("src/utils.ts");

      // All entries should be files since src only contains files
      expect(entries.every((e) => e.type === "file")).toBe(true);
    });

    it("returns empty array for non-existent directory", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const entries = await source.listFiles("nonexistent");

      expect(entries).toEqual([]);
    });

    it("prevents path traversal", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const entries = await source.listFiles("../../../etc");

      expect(entries).toEqual([]);
    });

    it("skips node_modules and .git directories", async () => {
      const source = new FilesystemSource({ rootPath: TEST_DIR });
      const entries = await source.listFiles();

      const paths = entries.map((e) => e.path);
      expect(paths).not.toContain("node_modules");
      expect(paths).not.toContain(".git");
    });
  });
});

