/**
 * Tests for search tool
 */
import { describe, it, expect, vi } from "vitest";
import { search } from "./search.js";
describe("search tool", () => {
    // Create mock DirectContext
    const createMockContext = (searchResult) => {
        return {
            search: vi.fn().mockResolvedValue(searchResult),
        };
    };
    // Create mock ToolContext
    const createToolContext = (context) => ({
        context,
        source: null,
        state: {
            contextState: {},
            source: {
                type: "filesystem",
                identifier: "/test",
                syncedAt: new Date().toISOString(),
            },
        },
    });
    it("returns results from DirectContext.search", async () => {
        const mockContext = createMockContext("Search result: file.ts line 1");
        const ctx = createToolContext(mockContext);
        const result = await search(ctx, "test query");
        expect(result.query).toBe("test query");
        expect(result.results).toBe("Search result: file.ts line 1");
        expect(mockContext.search).toHaveBeenCalledWith("test query", {
            maxOutputLength: undefined,
        });
    });
    it("passes maxOutputLength option", async () => {
        const mockContext = createMockContext("Result");
        const ctx = createToolContext(mockContext);
        await search(ctx, "query", { maxOutputLength: 5000 });
        expect(mockContext.search).toHaveBeenCalledWith("query", {
            maxOutputLength: 5000,
        });
    });
    it("returns empty string when search returns undefined", async () => {
        const mockContext = createMockContext(undefined);
        const ctx = createToolContext(mockContext);
        const result = await search(ctx, "query");
        expect(result.results).toBe("");
    });
    it("works without source configured", async () => {
        const mockContext = createMockContext("Result");
        const ctx = {
            context: mockContext,
            source: null,
            state: {
                contextState: {},
                source: {
                    type: "filesystem",
                    identifier: "/test",
                    syncedAt: new Date().toISOString(),
                },
            },
        };
        const result = await search(ctx, "query");
        expect(result.results).toBe("Result");
    });
});
//# sourceMappingURL=search.test.js.map