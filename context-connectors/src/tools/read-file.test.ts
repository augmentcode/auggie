/**
 * Tests for readFile tool
 */

import { describe, it, expect, vi } from "vitest";
import type { DirectContext } from "@augmentcode/auggie-sdk";
import type { Source } from "../sources/types.js";
import type { ToolContext } from "./types.js";
import { readFile } from "./read-file.js";

describe("readFile tool", () => {
  // Create mock Source
  const createMockSource = (fileContents: Map<string, string | null>) => {
    return {
      type: "filesystem" as const,
      readFile: vi.fn().mockImplementation((path: string) => {
        return Promise.resolve(fileContents.get(path) ?? null);
      }),
      listFiles: vi.fn(),
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

    await expect(readFile(ctx, "file.ts")).rejects.toThrow(
      "Source not configured. Cannot read files in search-only mode."
    );
  });

  it("returns file contents", async () => {
    const mockSource = createMockSource(
      new Map([["src/index.ts", "export const foo = 1;"]])
    );
    const ctx = createToolContext(mockSource);

    const result = await readFile(ctx, "src/index.ts");

    expect(result.path).toBe("src/index.ts");
    expect(result.contents).toBe("export const foo = 1;");
    expect(result.error).toBeUndefined();
  });

  it("returns error for missing file", async () => {
    const mockSource = createMockSource(new Map());
    const ctx = createToolContext(mockSource);

    const result = await readFile(ctx, "nonexistent.ts");

    expect(result.path).toBe("nonexistent.ts");
    expect(result.contents).toBeNull();
    expect(result.error).toBe("File not found or not readable");
  });

  it("calls source.readFile with correct path", async () => {
    const mockSource = createMockSource(
      new Map([["deep/nested/file.ts", "content"]])
    );
    const ctx = createToolContext(mockSource);

    await readFile(ctx, "deep/nested/file.ts");

    expect(mockSource.readFile).toHaveBeenCalledWith("deep/nested/file.ts");
  });
});

