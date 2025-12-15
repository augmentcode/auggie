/**
 * Tests for listFiles tool
 */
import { describe, it, expect, vi } from "vitest";
import { listFiles } from "./list-files.js";
describe("listFiles tool", () => {
    // Create mock Source
    const createMockSource = (files) => {
        return {
            type: "filesystem",
            listFiles: vi.fn().mockResolvedValue(files),
            readFile: vi.fn(),
            fetchAll: vi.fn(),
            fetchChanges: vi.fn(),
            getMetadata: vi.fn(),
        };
    };
    // Create mock DirectContext
    const createMockContext = () => {
        return {
            search: vi.fn(),
        };
    };
    // Create mock ToolContext
    const createToolContext = (source) => ({
        context: createMockContext(),
        source,
        state: {
            contextState: {},
            source: {
                type: "filesystem",
                identifier: "/test",
                syncedAt: new Date().toISOString(),
            },
        },
    });
    it("throws error when source is null", async () => {
        const ctx = createToolContext(null);
        await expect(listFiles(ctx)).rejects.toThrow("Source not configured. Cannot list files in search-only mode.");
    });
    it("returns file list from source", async () => {
        const mockSource = createMockSource([
            { path: "src/index.ts" },
            { path: "README.md" },
        ]);
        const ctx = createToolContext(mockSource);
        const files = await listFiles(ctx);
        expect(files).toHaveLength(2);
        expect(files[0].path).toBe("src/index.ts");
        expect(files[1].path).toBe("README.md");
        expect(mockSource.listFiles).toHaveBeenCalled();
    });
    it("filters by pattern when provided", async () => {
        const mockSource = createMockSource([
            { path: "src/index.ts" },
            { path: "src/utils.ts" },
            { path: "README.md" },
        ]);
        const ctx = createToolContext(mockSource);
        const files = await listFiles(ctx, { pattern: "**/*.ts" });
        expect(files).toHaveLength(2);
        expect(files.every((f) => f.path.endsWith(".ts"))).toBe(true);
    });
    it("returns empty array when no files match pattern", async () => {
        const mockSource = createMockSource([
            { path: "src/index.ts" },
            { path: "README.md" },
        ]);
        const ctx = createToolContext(mockSource);
        const files = await listFiles(ctx, { pattern: "**/*.py" });
        expect(files).toHaveLength(0);
    });
    it("returns all files when pattern is not provided", async () => {
        const mockSource = createMockSource([
            { path: "src/index.ts" },
            { path: "README.md" },
            { path: "package.json" },
        ]);
        const ctx = createToolContext(mockSource);
        const files = await listFiles(ctx);
        expect(files).toHaveLength(3);
    });
});
//# sourceMappingURL=list-files.test.js.map