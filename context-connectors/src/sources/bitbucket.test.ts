/**
 * Tests for BitBucketSource
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BitBucketSource } from "./bitbucket.js";

describe("BitBucketSource", () => {
  const originalEnv = process.env.BITBUCKET_TOKEN;

  beforeEach(() => {
    process.env.BITBUCKET_TOKEN = "test-token";
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.BITBUCKET_TOKEN = originalEnv;
    } else {
      delete process.env.BITBUCKET_TOKEN;
    }
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses provided token", () => {
      expect(() => {
        new BitBucketSource({
          token: "custom-token",
          workspace: "myworkspace",
          repo: "myrepo",
        });
      }).not.toThrow();
    });

    it("uses BITBUCKET_TOKEN from env", () => {
      expect(() => {
        new BitBucketSource({
          workspace: "myworkspace",
          repo: "myrepo",
        });
      }).not.toThrow();
    });

    it("throws if no token available", () => {
      delete process.env.BITBUCKET_TOKEN;
      expect(() => {
        new BitBucketSource({
          workspace: "myworkspace",
          repo: "myrepo",
        });
      }).toThrow(/BitBucket token required/);
    });

    it("uses HEAD as default ref", () => {
      const source = new BitBucketSource({
        workspace: "myworkspace",
        repo: "myrepo",
      });
      // @ts-expect-error - accessing private property for testing
      expect(source.ref).toBe("HEAD");
    });

    it("accepts custom ref", () => {
      const source = new BitBucketSource({
        workspace: "myworkspace",
        repo: "myrepo",
        ref: "develop",
      });
      // @ts-expect-error - accessing private property for testing
      expect(source.ref).toBe("develop");
    });

    it("uses default BitBucket Cloud URL", () => {
      const source = new BitBucketSource({
        workspace: "myworkspace",
        repo: "myrepo",
      });
      // @ts-expect-error - accessing private property for testing
      expect(source.baseUrl).toBe("https://api.bitbucket.org/2.0");
    });

    it("accepts custom base URL for Server/Data Center", () => {
      const source = new BitBucketSource({
        workspace: "myworkspace",
        repo: "myrepo",
        baseUrl: "https://bitbucket.mycompany.com/rest/api/1.0",
      });
      // @ts-expect-error - accessing private property for testing
      expect(source.baseUrl).toBe("https://bitbucket.mycompany.com/rest/api/1.0");
    });

    it("strips trailing slash from base URL", () => {
      const source = new BitBucketSource({
        workspace: "myworkspace",
        repo: "myrepo",
        baseUrl: "https://bitbucket.mycompany.com/rest/api/1.0/",
      });
      // @ts-expect-error - accessing private property for testing
      expect(source.baseUrl).toBe("https://bitbucket.mycompany.com/rest/api/1.0");
    });
  });

  describe("type", () => {
    it("returns 'bitbucket'", () => {
      const source = new BitBucketSource({
        workspace: "myworkspace",
        repo: "myrepo",
      });
      expect(source.type).toBe("bitbucket");
    });
  });

  // Integration tests - require BITBUCKET_TOKEN, BITBUCKET_WORKSPACE, and BITBUCKET_REPO env vars
  // BitBucket Cloud now requires authentication for all API access, so we can't use a hardcoded public repo
  const integrationWorkspace = process.env.BITBUCKET_WORKSPACE;
  const integrationRepo = process.env.BITBUCKET_REPO;
  const runIntegration = !!originalEnv && !!integrationWorkspace && !!integrationRepo;

  describe.skipIf(!runIntegration)("integration", () => {
    it("indexes a BitBucket repository", async () => {
      const source = new BitBucketSource({
        token: originalEnv,
        workspace: integrationWorkspace!,
        repo: integrationRepo!,
      });

      const files = await source.fetchAll();
      expect(files.length).toBeGreaterThan(0);
    });

    it("lists files from a repository", async () => {
      const source = new BitBucketSource({
        token: originalEnv,
        workspace: integrationWorkspace!,
        repo: integrationRepo!,
      });

      const files = await source.listFiles();
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toHaveProperty("path");
    });

    it("reads a single file from a repository", async () => {
      const source = new BitBucketSource({
        token: originalEnv,
        workspace: integrationWorkspace!,
        repo: integrationRepo!,
      });

      const content = await source.readFile("README.md");
      expect(content).not.toBeNull();
    });

    it("returns null for missing file", async () => {
      const source = new BitBucketSource({
        token: originalEnv,
        workspace: integrationWorkspace!,
        repo: integrationRepo!,
      });

      const content = await source.readFile("nonexistent-file-12345.txt");
      expect(content).toBeNull();
    });

    it("gets correct metadata", async () => {
      const source = new BitBucketSource({
        token: originalEnv,
        workspace: integrationWorkspace!,
        repo: integrationRepo!,
      });

      const metadata = await source.getMetadata();
      expect(metadata.type).toBe("bitbucket");
      expect(metadata.identifier).toBe(`${integrationWorkspace}/${integrationRepo}`);
      expect(metadata.ref).toBeDefined();
      expect(metadata.syncedAt).toBeDefined();
    });
  });
});

