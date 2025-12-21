/**
 * Tests for listFiles tool
 */

import { describe, it, expect, vi } from "vitest";
import type { DirectContext } from "@augmentcode/auggie-sdk";
import type { Source } from "../sources/types.js";
import type { ToolContext } from "./types.js";
import { listFiles } from "./list-files.js";
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

    const entries = await listFiles(ctx);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ path: "src", type: "directory" });
    expect(entries[1]).toEqual({ path: "README.md", type: "file" });
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

    const entries = await listFiles(ctx, { pattern: "*.ts" });

    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.path.endsWith(".ts"))).toBe(true);
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

    const entries = await listFiles(ctx);

    expect(entries).toHaveLength(3);
  });
});

