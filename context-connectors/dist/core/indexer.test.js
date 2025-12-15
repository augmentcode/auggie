/**
 * Tests for Indexer
 *
 * Note: Integration tests that use DirectContext require AUGMENT_API_TOKEN
 * and AUGMENT_API_URL environment variables to be set.
 *
 * These tests depend on @augmentcode/auggie-sdk being properly installed.
 * If the SDK fails to load, tests will be skipped.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
// Try to import SDK-dependent modules
let Indexer;
let FilesystemSource;
let FilesystemStore;
let sdkLoadError = null;
try {
    // These imports will fail if SDK is not properly installed
    const indexerMod = await import("./indexer.js");
    const sourceMod = await import("../sources/filesystem.js");
    const storeMod = await import("../stores/filesystem.js");
    Indexer = indexerMod.Indexer;
    FilesystemSource = sourceMod.FilesystemSource;
    FilesystemStore = storeMod.FilesystemStore;
}
catch (e) {
    sdkLoadError = e;
}
const TEST_SOURCE_DIR = "/tmp/context-connectors-test-indexer-source";
const TEST_STORE_DIR = "/tmp/context-connectors-test-indexer-store";
// Check if API credentials are available for integration tests
const hasApiCredentials = !!(process.env.AUGMENT_API_TOKEN && process.env.AUGMENT_API_URL);
// Skip all tests if SDK failed to load
describe.skipIf(sdkLoadError !== null)("Indexer", () => {
    beforeEach(async () => {
        // Create test directories
        await fs.mkdir(TEST_SOURCE_DIR, { recursive: true });
        await fs.mkdir(join(TEST_SOURCE_DIR, "src"), { recursive: true });
        // Create test files
        await fs.writeFile(join(TEST_SOURCE_DIR, "src/index.ts"), "export const hello = 'world';");
        await fs.writeFile(join(TEST_SOURCE_DIR, "README.md"), "# Test Project\nThis is a test.");
    });
    afterEach(async () => {
        // Clean up test directories
        await fs.rm(TEST_SOURCE_DIR, { recursive: true, force: true });
        await fs.rm(TEST_STORE_DIR, { recursive: true, force: true });
    });
    describe("Indexer configuration", () => {
        it("creates with default config", () => {
            const indexer = new Indexer();
            expect(indexer).toBeDefined();
        });
        it("creates with custom config", () => {
            const indexer = new Indexer({
                apiKey: "test-key",
                apiUrl: "https://api.test.com",
            });
            expect(indexer).toBeDefined();
        });
    });
    describe.skipIf(!hasApiCredentials)("Integration tests (require API credentials)", () => {
        it("performs full index end-to-end", async () => {
            const source = new FilesystemSource({ rootPath: TEST_SOURCE_DIR });
            const store = new FilesystemStore({ basePath: TEST_STORE_DIR });
            const indexer = new Indexer();
            const result = await indexer.index(source, store, "test-project");
            expect(result.type).toBe("full");
            expect(result.filesIndexed).toBeGreaterThan(0);
            expect(result.duration).toBeGreaterThan(0);
            // Verify state was saved
            const state = await store.load("test-project");
            expect(state).not.toBeNull();
            expect(state.source.type).toBe("filesystem");
            expect(state.contextState).toBeDefined();
        });
        it("returns unchanged when re-indexing same content", async () => {
            const source = new FilesystemSource({ rootPath: TEST_SOURCE_DIR });
            const store = new FilesystemStore({ basePath: TEST_STORE_DIR });
            const indexer = new Indexer();
            // First index
            const result1 = await indexer.index(source, store, "test-project");
            expect(result1.type).toBe("full");
            // Second index - should still be full since fetchChanges returns null
            // (incremental not supported in Phase 2)
            const result2 = await indexer.index(source, store, "test-project");
            expect(result2.type).toBe("full");
        });
        it("correctly handles empty directory", async () => {
            const emptyDir = "/tmp/context-connectors-test-empty";
            await fs.mkdir(emptyDir, { recursive: true });
            try {
                const source = new FilesystemSource({ rootPath: emptyDir });
                const store = new FilesystemStore({ basePath: TEST_STORE_DIR });
                const indexer = new Indexer();
                const result = await indexer.index(source, store, "empty-project");
                expect(result.type).toBe("full");
                expect(result.filesIndexed).toBe(0);
            }
            finally {
                await fs.rm(emptyDir, { recursive: true, force: true });
            }
        });
    });
    describe("Unit tests (no API required)", () => {
        it("FilesystemSource can be passed to index method signature", async () => {
            const source = new FilesystemSource({ rootPath: TEST_SOURCE_DIR });
            const store = new FilesystemStore({ basePath: TEST_STORE_DIR });
            const indexer = new Indexer();
            // Just verify the types work together - don't actually call index without API
            expect(source.type).toBe("filesystem");
            expect(typeof indexer.index).toBe("function");
            expect(typeof store.save).toBe("function");
        });
        it("source fetchAll returns expected files", async () => {
            const source = new FilesystemSource({ rootPath: TEST_SOURCE_DIR });
            const files = await source.fetchAll();
            expect(files.length).toBe(2);
            const paths = files.map((f) => f.path);
            expect(paths).toContain("src/index.ts");
            expect(paths).toContain("README.md");
        });
    });
});
//# sourceMappingURL=indexer.test.js.map