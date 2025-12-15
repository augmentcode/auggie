import { describe, it, expect, vi } from "vitest";
import { createAISDKTools, createLazyAISDKTools } from "./ai-sdk-tools.js";

describe("createAISDKTools", () => {
  it("creates search tool", () => {
    const mockClient = {
      hasSource: () => false,
      getMetadata: () => ({ type: "filesystem", identifier: "/test" }),
      search: vi.fn().mockResolvedValue({ results: "test results" }),
    };

    const tools = createAISDKTools({ client: mockClient as any });

    expect(tools.search).toBeDefined();
    expect((tools as any).listFiles).toBeUndefined();
    expect((tools as any).readFile).toBeUndefined();
  });

  it("includes file tools when source available", () => {
    const mockClient = {
      hasSource: () => true,
      getMetadata: () => ({ type: "filesystem", identifier: "/test" }),
      search: vi.fn(),
      listFiles: vi.fn(),
      readFile: vi.fn(),
    };

    const tools = createAISDKTools({ client: mockClient as any });

    expect(tools.search).toBeDefined();
    expect((tools as any).listFiles).toBeDefined();
    expect((tools as any).readFile).toBeDefined();
  });

  it("search tool executes correctly", async () => {
    const mockClient = {
      hasSource: () => false,
      getMetadata: () => ({ type: "filesystem", identifier: "/test" }),
      search: vi.fn().mockResolvedValue({ results: "found code" }),
    };

    const tools = createAISDKTools({ client: mockClient as any });
    const result = await tools.search.execute!({ query: "test" }, {} as any);

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
    await tools.search.execute!({ query: "test" }, {} as any);
    expect(initFn).toHaveBeenCalledTimes(1);

    // Second use reuses client
    await tools.search.execute!({ query: "test2" }, {} as any);
    expect(initFn).toHaveBeenCalledTimes(1);
  });
});

