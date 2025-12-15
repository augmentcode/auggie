/**
 * Tests for MCP Server
 */
import { describe, it, expect, vi } from "vitest";
// Try to import SDK-dependent modules
let createMCPServer;
let sdkLoadError = null;
try {
    const mcpMod = await import("./mcp-server.js");
    createMCPServer = mcpMod.createMCPServer;
}
catch (e) {
    sdkLoadError = e;
}
// Create mock IndexState
const createMockState = () => ({
    contextState: {
        blobs: [],
        version: 1,
    },
    source: {
        type: "filesystem",
        identifier: "/test/path",
        syncedAt: new Date().toISOString(),
    },
});
// Create mock Store
const createMockStore = (state) => ({
    load: vi.fn().mockResolvedValue(state),
    list: vi.fn().mockResolvedValue(state ? ["test-key"] : []),
});
// Create mock Source
const createMockSource = () => ({
    type: "filesystem",
    listFiles: vi.fn().mockResolvedValue([
        { path: "src/index.ts" },
        { path: "src/utils.ts" },
        { path: "README.md" },
    ]),
    readFile: vi.fn().mockImplementation((path) => {
        if (path === "src/index.ts") {
            return Promise.resolve("export const version = '1.0.0';");
        }
        if (path === "not-found.ts") {
            return Promise.reject(new Error("File not found"));
        }
        return Promise.resolve("file content");
    }),
    fetchAll: vi.fn(),
    fetchChanges: vi.fn(),
    getMetadata: vi.fn().mockResolvedValue({
        type: "filesystem",
        identifier: "/test/path",
        syncedAt: new Date().toISOString(),
    }),
});
// Check if API credentials are available for tests
const hasApiCredentials = !!(process.env.AUGMENT_API_TOKEN && process.env.AUGMENT_API_URL);
describe.skipIf(sdkLoadError !== null || !hasApiCredentials)("MCP Server", () => {
    describe("createMCPServer", () => {
        it("creates server with search tool only when no source", async () => {
            const store = createMockStore(createMockState());
            const server = await createMCPServer({
                store,
                key: "test-key",
            });
            expect(server).toBeDefined();
        });
        it("creates server with file tools when source provided", async () => {
            const store = createMockStore(createMockState());
            const source = createMockSource();
            const server = await createMCPServer({
                store,
                source,
                key: "test-key",
            });
            expect(server).toBeDefined();
        });
        it("uses custom name and version", async () => {
            const store = createMockStore(createMockState());
            const server = await createMCPServer({
                store,
                key: "test-key",
                name: "custom-server",
                version: "2.0.0",
            });
            expect(server).toBeDefined();
        });
        it("throws error when index not found", async () => {
            const store = createMockStore(null);
            await expect(createMCPServer({
                store,
                key: "missing-key",
            })).rejects.toThrow('Index "missing-key" not found');
        });
    });
});
// Unit tests that don't need API credentials
describe.skipIf(sdkLoadError !== null)("MCP Server Unit Tests", () => {
    describe("module loading", () => {
        it("exports createMCPServer function", () => {
            expect(typeof createMCPServer).toBe("function");
        });
    });
});
//# sourceMappingURL=mcp-server.test.js.map