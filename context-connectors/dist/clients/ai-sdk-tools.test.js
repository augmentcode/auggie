import { describe, it, expect, vi } from "vitest";
import { createAISDKTools, createLazyAISDKTools } from "./ai-sdk-tools.js";
describe("createAISDKTools", () => {
    it("creates search tool", () => {
        const mockClient = {
            hasSource: () => false,
            getMetadata: () => ({ type: "filesystem", identifier: "/test" }),
            search: vi.fn().mockResolvedValue({ results: "test results" }),
        };
        const tools = createAISDKTools({ client: mockClient });
        expect(tools.search).toBeDefined();
        expect(tools.listFiles).toBeUndefined();
        expect(tools.readFile).toBeUndefined();
    });
    it("includes file tools when source available", () => {
        const mockClient = {
            hasSource: () => true,
            getMetadata: () => ({ type: "filesystem", identifier: "/test" }),
            search: vi.fn(),
            listFiles: vi.fn(),
            readFile: vi.fn(),
        };
        const tools = createAISDKTools({ client: mockClient });
        expect(tools.search).toBeDefined();
        expect(tools.listFiles).toBeDefined();
        expect(tools.readFile).toBeDefined();
    });
    it("search tool executes correctly", async () => {
        const mockClient = {
            hasSource: () => false,
            getMetadata: () => ({ type: "filesystem", identifier: "/test" }),
            search: vi.fn().mockResolvedValue({ results: "found code" }),
        };
        const tools = createAISDKTools({ client: mockClient });
        const result = await tools.search.execute({ query: "test" }, {});
        expect(mockClient.search).toHaveBeenCalledWith("test", { maxOutputLength: undefined });
        expect(result).toBe("found code");
    });
});
describe("createLazyAISDKTools", () => {
    it("defers client initialization", async () => {
        const initFn = vi.fn().mockResolvedValue({
            search: vi.fn().mockResolvedValue({ results: "lazy results" }),
        });
        const tools = createLazyAISDKTools(initFn);
        // Client not initialized yet
        expect(initFn).not.toHaveBeenCalled();
        // First tool use initializes
        await tools.search.execute({ query: "test" }, {});
        expect(initFn).toHaveBeenCalledTimes(1);
        // Second use reuses client
        await tools.search.execute({ query: "test2" }, {});
        expect(initFn).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=ai-sdk-tools.test.js.map