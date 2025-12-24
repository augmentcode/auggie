/**
 * Tests for listFiles tool
 */

import { describe, it, expect, vi } from "vitest";
import type { DirectContext } from "@augmentcode/auggie-sdk";
import type { Source } from "../sources/types.js";
import type { ToolContext } from "./types.js";
import { listFiles, formatListOutput } from "./list-files.js";
import type { FileInfo } from "../core/types.js";

describe("listFiles tool", () => {
  // Create mock Source with file/directory entries
  const createMockSource = (entries: FileInfo[], directoryHandler?: (dir?: string) => FileInfo[]) => {
    const listFilesFn = directoryHandler
      ? vi.fn().mockImplementation((dir?: string) => Promise.resolve(directoryHandler(dir)))
      : vi.fn().mockResolvedValue(entries);

    return {
      type: "filesystem" as const,
      listFiles: listFilesFn,
      readFile: vi.fn(),
      fetchAll: vi.fn(),
      fetchChanges: vi.fn(),
      getMetadata: vi.fn(),
    } as unknown as Source;
  };

  // Create mock DirectContext
  const createMockContext = () => {
    return {
      search: vi.fn(),
    } as unknown as DirectContext;
  };

  // Create mock ToolContext
  const createToolContext = (source: Source | null): ToolContext => ({
    context: createMockContext(),
    source,
    state: {
      contextState: {} as any,
      source: {
        type: "filesystem",
        identifier: "/test",
        syncedAt: new Date().toISOString(),
      },
    },
  });

  it("throws error when source is null", async () => {
    const ctx = createToolContext(null);

    await expect(listFiles(ctx)).rejects.toThrow(
      "Source not configured. Cannot list files in search-only mode."
    );
  });

  it("returns file and directory entries from source", async () => {
    const mockSource = createMockSource([
      { path: "src", type: "directory" },
      { path: "README.md", type: "file" },
    ]);
    const ctx = createToolContext(mockSource);

    // With default depth=2, it recurses into directories
    // Use depth=1 to get only immediate children (original behavior)
    const entries = await listFiles(ctx, { depth: 1 });

    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({ path: "README.md", type: "file" });
    expect(entries).toContainEqual({ path: "src", type: "directory" });
    expect(mockSource.listFiles).toHaveBeenCalled();
  });

  it("passes directory parameter to source", async () => {
    const mockSource = createMockSource([], (dir?: string) => {
      if (dir === "src") {
        return [
          { path: "src/index.ts", type: "file" },
          { path: "src/utils.ts", type: "file" },
        ];
      }
      return [
        { path: "src", type: "directory" },
        { path: "README.md", type: "file" },
      ];
    });
    const ctx = createToolContext(mockSource);

    const entries = await listFiles(ctx, { directory: "src" });

    expect(entries).toHaveLength(2);
    expect(entries[0].path).toBe("src/index.ts");
    expect(mockSource.listFiles).toHaveBeenCalledWith("src");
  });

  it("filters by pattern (matches filename only)", async () => {
    const mockSource = createMockSource([
      { path: "src/index.ts", type: "file" },
      { path: "src/utils.ts", type: "file" },
      { path: "src/helpers", type: "directory" },
    ]);
    const ctx = createToolContext(mockSource);

    // Use depth=1 to avoid recursive listing for simpler test
    const entries = await listFiles(ctx, { pattern: "*.ts", depth: 1 });

    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.path.endsWith(".ts"))).toBe(true);
  });

  it("supports path-based patterns with matchBase", async () => {
    const mockSource = createMockSource([
      { path: "src/index.ts", type: "file" },
      { path: "src/utils.ts", type: "file" },
      { path: "lib/helper.ts", type: "file" },
    ]);
    const ctx = createToolContext(mockSource);

    // Pattern with path should match full path
    const entries = await listFiles(ctx, { pattern: "src/*.ts", depth: 1 });

    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.path.startsWith("src/"))).toBe(true);
  });

  it("returns empty array when no entries match pattern", async () => {
    const mockSource = createMockSource([
      { path: "src/index.ts", type: "file" },
      { path: "README.md", type: "file" },
    ]);
    const ctx = createToolContext(mockSource);

    const entries = await listFiles(ctx, { pattern: "*.py" });

    expect(entries).toHaveLength(0);
  });

  it("returns all entries when pattern is not provided", async () => {
    const mockSource = createMockSource([
      { path: "src", type: "directory" },
      { path: "README.md", type: "file" },
      { path: "package.json", type: "file" },
    ]);
    const ctx = createToolContext(mockSource);

    // Use depth=1 to avoid recursive listing for simpler test
    const entries = await listFiles(ctx, { depth: 1 });

    expect(entries).toHaveLength(3);
  });

  it("recursively lists entries with default depth", async () => {
    // Mock source that returns different results for different directories
    const mockSource = createMockSource([], (dir?: string) => {
      if (dir === "src") {
        return [
          { path: "src/index.ts", type: "file" },
        ];
      }
      return [
        { path: "src", type: "directory" },
        { path: "README.md", type: "file" },
      ];
    });
    const ctx = createToolContext(mockSource);

    // Default depth=2 should recurse into src/
    const entries = await listFiles(ctx);

    expect(entries).toHaveLength(3); // src, README.md, src/index.ts
    expect(entries).toContainEqual({ path: "src", type: "directory" });
    expect(entries).toContainEqual({ path: "README.md", type: "file" });
    expect(entries).toContainEqual({ path: "src/index.ts", type: "file" });
  });
});

describe("formatListOutput", () => {
  it("returns 'No files found.' for empty list", () => {
    const output = formatListOutput([]);
    expect(output).toBe("No files found.");
  });

  it("includes header with default options", () => {
    const entries: FileInfo[] = [
      { path: "src", type: "directory" },
      { path: "README.md", type: "file" },
    ];
    const output = formatListOutput(entries);

    expect(output).toContain("files and directories up to 2 levels deep");
    expect(output).toContain("the root directory");
    expect(output).toContain("excluding hidden items");
    expect(output).toContain("src [directory]");
    expect(output).toContain("README.md [file]");
  });

  it("includes header with custom directory", () => {
    const entries: FileInfo[] = [{ path: "src/index.ts", type: "file" }];
    const output = formatListOutput(entries, { directory: "src" });

    expect(output).toContain("in src");
  });

  it("describes depth=1 as immediate children", () => {
    const entries: FileInfo[] = [{ path: "file.ts", type: "file" }];
    const output = formatListOutput(entries, { depth: 1 });

    expect(output).toContain("immediate children");
    expect(output).not.toContain("levels deep");
  });

  it("describes showHidden correctly", () => {
    const entries: FileInfo[] = [{ path: ".hidden", type: "file" }];
    const output = formatListOutput(entries, { showHidden: true });

    expect(output).toContain("including hidden items");
  });
});

