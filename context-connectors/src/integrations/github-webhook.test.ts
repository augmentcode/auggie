import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import type { IndexStore } from "../stores/types.js";

// Mock the core/indexer module before importing github-webhook
vi.mock("../core/indexer.js", () => ({
  Indexer: vi.fn().mockImplementation(() => ({
    index: vi.fn().mockResolvedValue({
      type: "full",
      filesIndexed: 10,
      filesRemoved: 0,
      duration: 100,
    }),
  })),
}));

// Mock the sources/github module
vi.mock("../sources/github.js", () => ({
  GitHubSource: vi.fn().mockImplementation(() => ({})),
}));

// Now import the module under test
import {
  createGitHubWebhookHandler,
  verifyWebhookSignature,
  type PushEvent,
} from "./github-webhook.js";

describe("verifyWebhookSignature", () => {
  it("verifies valid signature", async () => {
    const payload = '{"test": true}';
    const secret = "test-secret";
    // Compute expected signature
    const expectedSignature =
      "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const valid = await verifyWebhookSignature(payload, expectedSignature, secret);
    expect(valid).toBe(true);
  });

  it("rejects invalid signature", async () => {
    const valid = await verifyWebhookSignature(
      "payload",
      "sha256=invalid",
      "secret"
    );
    expect(valid).toBe(false);
  });
});

describe("createGitHubWebhookHandler", () => {
  let mockStore: IndexStore;

  beforeEach(() => {
    mockStore = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    };
  });

  const pushEvent: PushEvent = {
    ref: "refs/heads/main",
    before: "abc123",
    after: "def456",
    deleted: false,
    forced: false,
    repository: {
      full_name: "owner/repo",
      owner: { login: "owner" },
      name: "repo",
      default_branch: "main",
    },
    pusher: { name: "user" },
  };

  it("skips non-push events", async () => {
    const handler = createGitHubWebhookHandler({ store: mockStore, secret: "s" });
    const result = await handler("pull_request", pushEvent);
    expect(result.status).toBe("skipped");
  });

  it("skips deleted branches", async () => {
    const handler = createGitHubWebhookHandler({ store: mockStore, secret: "s" });
    const result = await handler("push", { ...pushEvent, deleted: true });
    expect(result.status).toBe("skipped");
  });

  it("deletes index when deleteOnBranchDelete is true", async () => {
    const handler = createGitHubWebhookHandler({
      store: mockStore,
      secret: "s",
      deleteOnBranchDelete: true,
    });
    const result = await handler("push", { ...pushEvent, deleted: true });
    expect(result.status).toBe("deleted");
    expect(mockStore.delete).toHaveBeenCalled();
  });

  it("uses custom getKey function", async () => {
    const getKey = vi.fn((repo: string) => `custom-${repo}`);
    const handler = createGitHubWebhookHandler({
      store: mockStore,
      secret: "s",
      getKey,
      shouldIndex: () => false, // Skip indexing to just test getKey
    });
    await handler("push", pushEvent);
    expect(getKey).toHaveBeenCalledWith("owner/repo", "refs/heads/main");
  });

  it("respects shouldIndex filter", async () => {
    const handler = createGitHubWebhookHandler({
      store: mockStore,
      secret: "s",
      shouldIndex: () => false,
    });
    const result = await handler("push", pushEvent);
    expect(result.status).toBe("skipped");
    expect(result.message).toContain("shouldIndex");
  });

  it("skips tag pushes by default", async () => {
    const handler = createGitHubWebhookHandler({ store: mockStore, secret: "s" });
    const tagEvent = { ...pushEvent, ref: "refs/tags/v1.0.0" };
    const result = await handler("push", tagEvent);
    expect(result.status).toBe("skipped");
  });

  it("generates correct default key", async () => {
    const handler = createGitHubWebhookHandler({
      store: mockStore,
      secret: "s",
      shouldIndex: () => false, // Skip indexing to check key
    });
    const result = await handler("push", pushEvent);
    expect(result.key).toBe("owner/repo/main");
  });
});

