import { Indexer } from "../core/indexer.js";
import { GitHubSource } from "../sources/github.js";
import type { IndexStore } from "../stores/types.js";
import type { IndexResult } from "../core/types.js";

export interface PushEvent {
  ref: string;
  before: string;
  after: string;
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
    default_branch: string;
  };
  pusher: { name: string };
  deleted: boolean;
  forced: boolean;
}

export interface GitHubWebhookConfig {
  store: IndexStore;
  secret: string;

  /** Generate index key from repo/ref. Default: "owner/repo/branch" */
  getKey?: (repo: string, ref: string) => string;

  /** Filter which pushes trigger indexing. Default: all non-delete pushes */
  shouldIndex?: (event: PushEvent) => boolean;

  /** Called after successful indexing */
  onIndexed?: (key: string, result: IndexResult) => void | Promise<void>;

  /** Called on errors */
  onError?: (error: Error, event: PushEvent) => void | Promise<void>;

  /** Delete index when branch is deleted. Default: false */
  deleteOnBranchDelete?: boolean;
}

export interface WebhookResult {
  status: "indexed" | "deleted" | "skipped" | "error";
  key?: string;
  message: string;
  filesIndexed?: number;
}

/**
 * Verify GitHub webhook signature
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const crypto = await import("crypto");
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  // timingSafeEqual requires buffers of the same length
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Create a GitHub webhook handler
 */
export function createGitHubWebhookHandler(config: GitHubWebhookConfig) {
  const defaultGetKey = (repo: string, ref: string) => {
    const branch = ref.replace("refs/heads/", "").replace("refs/tags/", "");
    return `${repo}/${branch}`;
  };

  const defaultShouldIndex = (event: PushEvent) => {
    // Don't index deletions
    if (event.deleted) return false;
    // Only index branch pushes (not tags by default)
    if (!event.ref.startsWith("refs/heads/")) return false;
    return true;
  };

  return async function handleWebhook(
    eventType: string,
    payload: PushEvent
  ): Promise<WebhookResult> {
    // Only handle push events
    if (eventType !== "push") {
      return {
        status: "skipped",
        message: `Event type "${eventType}" not handled`,
      };
    }

    const getKey = config.getKey ?? defaultGetKey;
    const shouldIndex = config.shouldIndex ?? defaultShouldIndex;
    const key = getKey(payload.repository.full_name, payload.ref);

    // Handle branch deletion
    if (payload.deleted) {
      if (config.deleteOnBranchDelete) {
        await config.store.delete(key);
        return { status: "deleted", key, message: `Deleted index for ${key}` };
      }
      return { status: "skipped", key, message: "Branch deleted, index preserved" };
    }

    // Check if we should index
    if (!shouldIndex(payload)) {
      return { status: "skipped", key, message: "Filtered by shouldIndex" };
    }

    try {
      const source = new GitHubSource({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        ref: payload.after,
      });

      const indexer = new Indexer();
      const result = await indexer.index(source, config.store, key);

      await config.onIndexed?.(key, result);

      return {
        status: "indexed",
        key,
        message: `Indexed ${result.filesIndexed} files`,
        filesIndexed: result.filesIndexed,
      };
    } catch (error) {
      await config.onError?.(error as Error, payload);
      return {
        status: "error",
        key,
        message: (error as Error).message,
      };
    }
  };
}

