# Phase 9.5: GitHub Webhook Integration

## Overview

This phase provides building blocks for integrating context-connectors into GitHub Apps. Users can add automatic indexing to their existing apps or deploy standalone webhook handlers.

**Depends on**: Phase 4 (GitHub Source) complete

## Goals

1. Provide a webhook handler that triggers indexing on push events
2. Handle webhook signature verification
3. Support common deployment targets (Vercel, Express, Lambda)
4. Make it easy to customize indexing behavior

## Files to Create

### 1. `src/integrations/github-webhook.ts`

Core webhook handler.

```typescript
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
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
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
      return { status: "skipped", message: `Event type "${eventType}" not handled` };
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
```

### 2. `src/integrations/github-webhook-vercel.ts`

Vercel/Next.js adapter.

```typescript
import {
  createGitHubWebhookHandler,
  verifyWebhookSignature,
  type GitHubWebhookConfig,
  type PushEvent,
} from "./github-webhook.js";

type VercelRequest = {
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
};

type VercelResponse = Response;

export function createVercelHandler(config: GitHubWebhookConfig) {
  const handler = createGitHubWebhookHandler(config);

  return async function POST(request: VercelRequest): Promise<VercelResponse> {
    const signature = request.headers.get("x-hub-signature-256");
    const eventType = request.headers.get("x-github-event");

    if (!signature || !eventType) {
      return Response.json(
        { error: "Missing required headers" },
        { status: 400 }
      );
    }

    const body = await request.text();

    const valid = await verifyWebhookSignature(body, signature, config.secret);
    if (!valid) {
      return Response.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body) as PushEvent;
    const result = await handler(eventType, payload);

    const status = result.status === "error" ? 500 : 200;
    return Response.json(result, { status });
  };
}
```

### 3. `src/integrations/github-webhook-express.ts`

Express/Node.js adapter.

```typescript
import type { Request, Response, NextFunction } from "express";
import {
  createGitHubWebhookHandler,
  verifyWebhookSignature,
  type GitHubWebhookConfig,
  type PushEvent,
} from "./github-webhook.js";

export function createExpressHandler(config: GitHubWebhookConfig) {
  const handler = createGitHubWebhookHandler(config);

  return async function middleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const signature = req.headers["x-hub-signature-256"] as string;
      const eventType = req.headers["x-github-event"] as string;

      if (!signature || !eventType) {
        res.status(400).json({ error: "Missing required headers" });
        return;
      }

      // Requires raw body - use express.raw() middleware
      const body = typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);

      const valid = await verifyWebhookSignature(body, signature, config.secret);
      if (!valid) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const payload = (typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body) as PushEvent;

      const result = await handler(eventType, payload);

      const status = result.status === "error" ? 500 : 200;
      res.status(status).json(result);
    } catch (error) {
      next(error);
    }
  };
}
```

### 4. `src/integrations/index.ts`

Export integrations.

```typescript
export {
  createGitHubWebhookHandler,
  verifyWebhookSignature,
  type GitHubWebhookConfig,
  type PushEvent,
  type WebhookResult,
} from "./github-webhook.js";

export { createVercelHandler } from "./github-webhook-vercel.js";
export { createExpressHandler } from "./github-webhook-express.js";
```

### 5. Update `package.json` exports

```json
{
  "exports": {
    "./integrations": {
      "types": "./dist/integrations/index.d.ts",
      "import": "./dist/integrations/index.js"
    },
    "./integrations/vercel": {
      "types": "./dist/integrations/github-webhook-vercel.d.ts",
      "import": "./dist/integrations/github-webhook-vercel.js"
    },
    "./integrations/express": {
      "types": "./dist/integrations/github-webhook-express.d.ts",
      "import": "./dist/integrations/github-webhook-express.js"
    }
  }
}
```

---

## Usage Examples

### Vercel / Next.js App Router

```typescript
// app/api/webhook/route.ts
import { createVercelHandler } from "@augmentcode/context-connectors/integrations/vercel";
import { S3Store } from "@augmentcode/context-connectors/stores";

const store = new S3Store({ bucket: process.env.INDEX_BUCKET! });

export const POST = createVercelHandler({
  store,
  secret: process.env.GITHUB_WEBHOOK_SECRET!,

  // Only index main branch
  shouldIndex: (event) => event.ref === "refs/heads/main",

  // Custom key format
  getKey: (repo, ref) => repo.replace("/", "-"),

  // Log results
  onIndexed: (key, result) => {
    console.log(`Indexed ${key}: ${result.filesIndexed} files`);
  },
});
```

### Express

```typescript
import express from "express";
import { createExpressHandler } from "@augmentcode/context-connectors/integrations/express";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

const app = express();
const store = new FilesystemStore({ basePath: "./indexes" });

// Must use raw body for signature verification
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  createExpressHandler({
    store,
    secret: process.env.GITHUB_WEBHOOK_SECRET!,
  })
);

app.listen(3000);
```

### Custom / Any Framework

```typescript
import {
  createGitHubWebhookHandler,
  verifyWebhookSignature
} from "@augmentcode/context-connectors/integrations";
import { S3Store } from "@augmentcode/context-connectors/stores";

const store = new S3Store({ bucket: "my-indexes" });
const handler = createGitHubWebhookHandler({ store, secret: "..." });

// In your request handler:
async function handleRequest(req: Request) {
  const signature = req.headers["x-hub-signature-256"];
  const eventType = req.headers["x-github-event"];
  const body = await req.text();

  // Verify signature
  if (!await verifyWebhookSignature(body, signature, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Handle webhook
  const result = await handler(eventType, JSON.parse(body));
  return Response.json(result);
}
```

---

## GitHub App Setup

### 1. Create GitHub App

1. Go to **Settings → Developer settings → GitHub Apps → New GitHub App**
2. Set webhook URL to your deployed handler
3. Generate and save webhook secret
4. Required permissions:
   - **Repository contents**: Read
5. Subscribe to events:
   - **Push**

### 2. Configure Environment

```bash
# Required
GITHUB_WEBHOOK_SECRET=your-webhook-secret
AUGMENT_API_TOKEN=your-augment-token
AUGMENT_API_URL=https://your-tenant.api.augmentcode.com/

# For S3 store
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
INDEX_BUCKET=my-index-bucket

# For GitHub API (private repos)
GITHUB_TOKEN=your-github-token
```

### 3. Install App

Install the GitHub App on repositories you want to index.

---

## Testing

### `src/integrations/github-webhook.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGitHubWebhookHandler,
  verifyWebhookSignature,
  type PushEvent,
} from "./github-webhook.js";

describe("verifyWebhookSignature", () => {
  it("verifies valid signature", async () => {
    const payload = '{"test": true}';
    const secret = "test-secret";
    // Pre-computed signature for this payload/secret
    const signature = "sha256=...";

    const valid = await verifyWebhookSignature(payload, signature, secret);
    expect(valid).toBe(true);
  });

  it("rejects invalid signature", async () => {
    const valid = await verifyWebhookSignature("payload", "sha256=invalid", "secret");
    expect(valid).toBe(false);
  });
});

describe("createGitHubWebhookHandler", () => {
  let mockStore: any;
  let mockIndexer: any;

  beforeEach(() => {
    mockStore = {
      save: vi.fn(),
      load: vi.fn(),
      delete: vi.fn(),
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
    const handler = createGitHubWebhookHandler({
      store: mockStore,
      secret: "s",
      getKey: (repo, ref) => `custom-${repo}`,
    });
    // Would need to mock Indexer for full test
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
});
```

---

## Acceptance Criteria

- [ ] `verifyWebhookSignature` correctly validates signatures
- [ ] Handler processes push events and triggers indexing
- [ ] Handler skips non-push events
- [ ] Handler respects `shouldIndex` filter
- [ ] Handler supports `deleteOnBranchDelete`
- [ ] Vercel adapter works with Next.js App Router
- [ ] Express adapter works with raw body middleware
- [ ] All tests pass
- [ ] `npm run build` compiles without errors

## Notes

- Webhook handlers should respond quickly (< 10s) to avoid GitHub retries
- For long indexing jobs, consider queuing (e.g., return 202, process async)
- Private repos require `GITHUB_TOKEN` with appropriate permissions
- Consider adding rate limiting for high-traffic installations
- Consider adding Slack/Discord notifications via `onIndexed`/`onError` hooks

