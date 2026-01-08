/**
 * Tests for S3Store
 *
 * Unit tests mock the S3 client.
 * Integration tests require AWS credentials and skip if not available.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IndexState, IndexStateSearchOnly } from "../core/types.js";

// Mock the @aws-sdk/client-s3 module
vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
    GetObjectCommand: vi.fn(),
    PutObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    ListObjectsV2Command: vi.fn(),
    __mockSend: mockSend,
  };
});

describe("S3Store", () => {
  const createTestState = (
    id: string
  ): { full: IndexState; search: IndexStateSearchOnly } => {
    const source = {
      type: "github" as const,
      config: { owner: "test-owner", repo: `test-repo-${id}` },
      syncedAt: new Date().toISOString(),
    };
    return {
      full: {
        version: 1,
        contextState: {
          mode: "full" as const,
          checkpointId: `checkpoint-${id}`,
          addedBlobs: [],
          deletedBlobs: [],
          blobs: [],
        },
        source,
      },
      search: {
        version: 1,
        contextState: {
          mode: "search-only" as const,
          checkpointId: `checkpoint-${id}`,
          addedBlobs: [],
          deletedBlobs: [],
        },
        source,
      },
    };
  };

  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const s3Module = await import("@aws-sdk/client-s3");
    mockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("configuration", () => {
    it("should use default prefix and region", async () => {
      const { S3Store } = await import("./s3.js");
      const store = new S3Store({ bucket: "test-bucket" });

      // Trigger client initialization
      mockSend.mockResolvedValueOnce({
        Body: { transformToString: () => Promise.resolve(null) },
      });
      await store.loadState("test");

      const { S3Client } = await import("@aws-sdk/client-s3");
      expect(S3Client).toHaveBeenCalledWith({
        region: "us-east-1",
        endpoint: undefined,
        forcePathStyle: false,
      });
    });

    it("should use custom configuration", async () => {
      const { S3Store } = await import("./s3.js");
      const store = new S3Store({
        bucket: "test-bucket",
        prefix: "custom/",
        region: "eu-west-1",
        endpoint: "http://localhost:9000",
        forcePathStyle: true,
      });

      mockSend.mockResolvedValueOnce({
        Body: { transformToString: () => Promise.resolve(null) },
      });
      await store.loadState("test");

      const { S3Client } = await import("@aws-sdk/client-s3");
      expect(S3Client).toHaveBeenCalledWith({
        region: "eu-west-1",
        endpoint: "http://localhost:9000",
        forcePathStyle: true,
      });
    });
  });

  describe("loadState", () => {
    it("should load state from S3", async () => {
      const { S3Store } = await import("./s3.js");
      const store = new S3Store({ bucket: "test-bucket" });
      const { full } = createTestState("1");

      mockSend.mockResolvedValueOnce({
        Body: {
          transformToString: () => Promise.resolve(JSON.stringify(full)),
        },
      });

      const loaded = await store.loadState("test-key");
      expect(loaded).toEqual(full);
    });

    it("should return null for non-existent key", async () => {
      const { S3Store } = await import("./s3.js");
      const store = new S3Store({ bucket: "test-bucket" });

      // Mock file as not found
      mockSend.mockRejectedValueOnce({ name: "NoSuchKey" });

      const loaded = await store.loadState("non-existent");
      expect(loaded).toBeNull();
    });
  });

  describe("save", () => {
    it("should save state to S3", async () => {
      const { S3Store } = await import("./s3.js");
      const store = new S3Store({ bucket: "test-bucket" });
      const { full, search } = createTestState("1");

      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});

      await store.save("test-key", full, search);

      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "context-connectors/test-key/state.json",
        Body: JSON.stringify(full, null, 2),
        ContentType: "application/json",
      });
    });
  });

  describe("delete", () => {
    it("should delete state from S3", async () => {
      const { S3Store } = await import("./s3.js");
      const store = new S3Store({ bucket: "test-bucket" });

      mockSend.mockResolvedValueOnce({});

      await store.delete("test-key");

      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "context-connectors/test-key/state.json",
      });
    });
  });

  describe("list", () => {
    it("should list keys from S3", async () => {
      const { S3Store } = await import("./s3.js");
      const store = new S3Store({ bucket: "test-bucket" });

      mockSend.mockResolvedValueOnce({
        CommonPrefixes: [
          { Prefix: "context-connectors/key1/" },
          { Prefix: "context-connectors/key2/" },
        ],
      });

      const keys = await store.list();
      expect(keys.sort()).toEqual(["key1", "key2"]);
    });
  });
});

