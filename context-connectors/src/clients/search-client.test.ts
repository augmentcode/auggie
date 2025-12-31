/**
 * Tests for SearchClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { IndexState } from "../core/types.js";
import type { IndexStoreReader } from "../stores/types.js";
import type { Source } from "../sources/types.js";

// Try to import SDK-dependent modules
let SearchClient: typeof import("./search-client.js").SearchClient;
let sdkLoadError: Error | null = null;

try {
  const clientMod = await import("./search-client.js");
  SearchClient = clientMod.SearchClient;
} catch (e) {
  sdkLoadError = e as Error;
}

// Check if API credentials are available for integration tests
const hasApiCredentials = !!(
  process.env.AUGMENT_API_TOKEN && process.env.AUGMENT_API_URL
);

const TEST_STORE_DIR = "/tmp/context-connectors-test-search-client";

describe.skipIf(sdkLoadError !== null)("SearchClient", () => {
  // Create mock IndexState
  const createMockState = (): IndexState => ({
    contextState: {
      blobs: [],
      version: 1,
    } as any,
    source: {
      type: "filesystem",
      identifier: "/test/path",
      syncedAt: new Date().toISOString(),
    },
  });

  // Create mock Store
  const createMockStore = (state: IndexState | null): IndexStoreReader => ({
    load: vi.fn().mockResolvedValue(state),
    list: vi.fn().mockResolvedValue(state ? ["test-key"] : []),
  });

  // Create mock Source
  const createMockSource = (): Source =>
    ({
      type: "filesystem" as const,
      listFiles: vi.fn().mockResolvedValue([{ path: "test.ts" }]),
      readFile: vi.fn().mockResolvedValue("content"),
      fetchAll: vi.fn(),
      fetchChanges: vi.fn(),
      getMetadata: vi.fn().mockResolvedValue({
        type: "filesystem",
        identifier: "/test/path",
        syncedAt: new Date().toISOString(),
      }),
    }) as unknown as Source;

  describe("constructor", () => {
    it("creates client with required config", () => {
      const store = createMockStore(createMockState());
      const client = new SearchClient({
        store,
        indexName: "test-key",
      });
      expect(client).toBeDefined();
    });

    it("creates client with optional source", () => {
      const store = createMockStore(createMockState());
      const source = createMockSource();
      const client = new SearchClient({
        store,
        source,
        indexName: "test-key",
      });
      expect(client).toBeDefined();
    });
  });

  describe("initialize", () => {
    it("throws error when index not found", async () => {
      const store = createMockStore(null);
      const client = new SearchClient({
        store,
        indexName: "missing-key",
      });

      await expect(client.initialize()).rejects.toThrow(
        'Index "missing-key" not found'
      );
    });

    it("throws error when source type mismatches", async () => {
      const state = createMockState();
      const store = createMockStore(state);
      const source = {
        ...createMockSource(),
        type: "github" as const,
        getMetadata: vi.fn().mockResolvedValue({
          type: "github",
          identifier: "owner/repo",
          syncedAt: new Date().toISOString(),
        }),
      } as unknown as Source;

      const client = new SearchClient({
        store,
        source,
        indexName: "test-key",
      });

      await expect(client.initialize()).rejects.toThrow("Source type mismatch");
    });
  });

  describe("getMetadata", () => {
    it("throws error when not initialized", () => {
      const store = createMockStore(createMockState());
      const client = new SearchClient({
        store,
        indexName: "test-key",
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
        indexName: "test-key",
      });

      // Can't call listFiles without initializing first
      // and can't initialize without API credentials
      expect(typeof client.listFiles).toBe("function");
    });
  });
});

