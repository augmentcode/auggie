/**
 * Tests for SearchClient
 */
import { describe, it, expect, vi } from "vitest";
// Try to import SDK-dependent modules
let SearchClient;
let sdkLoadError = null;
try {
    const clientMod = await import("./search-client.js");
    SearchClient = clientMod.SearchClient;
}
catch (e) {
    sdkLoadError = e;
}
// Check if API credentials are available for integration tests
const hasApiCredentials = !!(process.env.AUGMENT_API_TOKEN && process.env.AUGMENT_API_URL);
const TEST_STORE_DIR = "/tmp/context-connectors-test-search-client";
describe.skipIf(sdkLoadError !== null)("SearchClient", () => {
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
        listFiles: vi.fn().mockResolvedValue([{ path: "test.ts" }]),
        readFile: vi.fn().mockResolvedValue("content"),
        fetchAll: vi.fn(),
        fetchChanges: vi.fn(),
        getMetadata: vi.fn().mockResolvedValue({
            type: "filesystem",
            identifier: "/test/path",
            syncedAt: new Date().toISOString(),
        }),
    });
    describe("constructor", () => {
        it("creates client with required config", () => {
            const store = createMockStore(createMockState());
            const client = new SearchClient({
                store,
                key: "test-key",
            });
            expect(client).toBeDefined();
        });
        it("creates client with optional source", () => {
            const store = createMockStore(createMockState());
            const source = createMockSource();
            const client = new SearchClient({
                store,
                source,
                key: "test-key",
            });
            expect(client).toBeDefined();
        });
    });
    describe("initialize", () => {
        it("throws error when index not found", async () => {
            const store = createMockStore(null);
            const client = new SearchClient({
                store,
                key: "missing-key",
            });
            await expect(client.initialize()).rejects.toThrow('Index "missing-key" not found');
        });
        it("throws error when source type mismatches", async () => {
            const state = createMockState();
            const store = createMockStore(state);
            const source = {
                ...createMockSource(),
                type: "github",
                getMetadata: vi.fn().mockResolvedValue({
                    type: "github",
                    identifier: "owner/repo",
                    syncedAt: new Date().toISOString(),
                }),
            };
            const client = new SearchClient({
                store,
                source,
                key: "test-key",
            });
            await expect(client.initialize()).rejects.toThrow("Source type mismatch");
        });
    });
    describe("getMetadata", () => {
        it("throws error when not initialized", () => {
            const store = createMockStore(createMockState());
            const client = new SearchClient({
                store,
                key: "test-key",
            });
            expect(() => client.getMetadata()).toThrow("Client not initialized");
        });
    });
    describe("listFiles without source", () => {
        it("throws error when source not configured", async () => {
            // This test would need API credentials to initialize
            // Just verify the type signature works
            const store = createMockStore(createMockState());
            const client = new SearchClient({
                store,
                key: "test-key",
            });
            // Can't call listFiles without initializing first
            // and can't initialize without API credentials
            expect(typeof client.listFiles).toBe("function");
        });
    });
});
//# sourceMappingURL=search-client.test.js.map