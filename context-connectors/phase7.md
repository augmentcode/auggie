# Phase 7: AI SDK Tools

## Overview

This phase creates tools compatible with Vercel's AI SDK, enabling developers to easily add codebase search capabilities to their AI agents and chatbots.

**Reference**: https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling

**Depends on**: Phase 6 complete

## Goal

Create AI SDK-compatible tool definitions that:
1. Work with `generateText`, `streamText`, and agent loops
2. Provide `search`, `listFiles`, and `readFile` tools
3. Are easy to integrate with any AI SDK application
4. Support both initialized client and lazy initialization

## Prerequisites

- Understanding of AI SDK tool format
- `ai` package (Vercel AI SDK) as optional peer dependency

## AI SDK Tool Format

AI SDK tools use the `tool()` helper with Zod schemas:

```typescript
import { tool } from "ai";
import { z } from "zod";

const myTool = tool({
  description: "Tool description",
  parameters: z.object({
    param1: z.string().describe("Parameter description"),
  }),
  execute: async ({ param1 }) => {
    return "result";
  },
});
```

## Files to Create

### 1. Update `package.json`

Add AI SDK and Zod as optional peer dependencies:

```json
{
  "peerDependencies": {
    "ai": ">=3.0.0",
    "zod": ">=3.0.0"
  },
  "peerDependenciesMeta": {
    "ai": { "optional": true },
    "zod": { "optional": true }
  }
}
```

### 2. `src/clients/ai-sdk-tools.ts`

AI SDK compatible tools factory.

```typescript
import { tool } from "ai";
import { z } from "zod";
import type { SearchClient } from "./search-client.js";

export interface AISDKToolsConfig {
  client: SearchClient;
}

/**
 * Create AI SDK compatible tools from a SearchClient
 */
export function createAISDKTools(config: AISDKToolsConfig) {
  const { client } = config;
  const hasSource = client.hasSource();
  const meta = client.getMetadata();

  const tools: Record<string, ReturnType<typeof tool>> = {
    search: tool({
      description: `Search the codebase (${meta.type}://${meta.identifier}) using natural language. Returns relevant code snippets and file paths.`,
      parameters: z.object({
        query: z.string().describe("Natural language search query describing what you're looking for"),
        maxChars: z.number().optional().describe("Maximum characters in response"),
      }),
      execute: async ({ query, maxChars }) => {
        const result = await client.search(query, { maxOutputLength: maxChars });
        return result.results || "No results found.";
      },
    }),
  };

  // Only add file tools if source is available
  if (hasSource) {
    tools.listFiles = tool({
      description: "List all files in the codebase. Optionally filter by glob pattern.",
      parameters: z.object({
        pattern: z.string().optional().describe("Glob pattern to filter files (e.g., '**/*.ts', 'src/**')"),
      }),
      execute: async ({ pattern }) => {
        const files = await client.listFiles({ pattern });
        return files.map(f => f.path).join("\n");
      },
    });

    tools.readFile = tool({
      description: "Read the contents of a specific file from the codebase.",
      parameters: z.object({
        path: z.string().describe("Path to the file to read"),
      }),
      execute: async ({ path }) => {
        const result = await client.readFile(path);
        if (result.error) {
          return `Error: ${result.error}`;
        }
        return result.contents ?? "";
      },
    });
  }

  return tools;
}

/**
 * Create tools with lazy initialization
 * Useful when you want to defer client setup until first tool use
 */
export function createLazyAISDKTools(
  initClient: () => Promise<SearchClient>
) {
  let client: SearchClient | null = null;
  let initPromise: Promise<SearchClient> | null = null;

  const getClient = async () => {
    if (client) return client;
    if (!initPromise) {
      initPromise = initClient().then(c => {
        client = c;
        return c;
      });
    }
    return initPromise;
  };

  return {
    search: tool({
      description: "Search the codebase using natural language.",
      parameters: z.object({
        query: z.string().describe("Natural language search query"),
        maxChars: z.number().optional().describe("Maximum characters in response"),
      }),
      execute: async ({ query, maxChars }) => {
        const c = await getClient();
        const result = await c.search(query, { maxOutputLength: maxChars });
        return result.results || "No results found.";
      },
    }),
    
    listFiles: tool({
      description: "List files in the codebase.",
      parameters: z.object({
        pattern: z.string().optional().describe("Glob pattern to filter"),
      }),
      execute: async ({ pattern }) => {
        const c = await getClient();
        const files = await c.listFiles({ pattern });
        return files.map(f => f.path).join("\n");
      },
    }),
    
    readFile: tool({
      description: "Read a file from the codebase.",
      parameters: z.object({
        path: z.string().describe("File path"),
      }),
      execute: async ({ path }) => {
        const c = await getClient();
        const result = await c.readFile(path);
        return result.error ? `Error: ${result.error}` : result.contents ?? "";
      },
    }),
  };
}
```

### 3. Update `src/clients/index.ts`

Export the new tools:

```typescript
export { createAISDKTools, createLazyAISDKTools } from "./ai-sdk-tools.js";
```

### 4. `examples/ai-sdk-agent/README.md`

Example documentation:

```markdown
# AI SDK Agent Example

This example shows how to use context-connectors with Vercel AI SDK.

## Setup

```bash
npm install ai @ai-sdk/openai zod @augmentcode/context-connectors
```

## Usage

```typescript
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { SearchClient, createAISDKTools } from "@augmentcode/context-connectors";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

// Initialize the client
const store = new FilesystemStore({ basePath: ".context-connectors" });
const client = new SearchClient({ store, key: "my-project" });
await client.initialize();

// Create tools
const tools = createAISDKTools({ client });

// Use in generateText
const result = await generateText({
  model: openai("gpt-4o"),
  tools,
  maxSteps: 5,
  prompt: "Find the authentication logic in this codebase",
});

console.log(result.text);
```

## With Lazy Initialization

```typescript
import { createLazyAISDKTools, SearchClient } from "@augmentcode/context-connectors";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

const tools = createLazyAISDKTools(async () => {
  const store = new FilesystemStore({ basePath: ".context-connectors" });
  const client = new SearchClient({ store, key: "my-project" });
  await client.initialize();
  return client;
});

// Client only initialized when tools are first used
```
```

### 5. `examples/ai-sdk-agent/agent.ts`

Complete example:

```typescript
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { SearchClient, createAISDKTools } from "../../src/clients/index.js";
import { FilesystemStore } from "../../src/stores/filesystem.js";
import { FilesystemSource } from "../../src/sources/filesystem.js";

async function main() {
  const indexKey = process.argv[2] || "example";
  const query = process.argv[3] || "How does this project work?";

  // Setup
  const store = new FilesystemStore({ basePath: ".context-connectors" });
  const source = new FilesystemSource({ rootPath: "." });
  const client = new SearchClient({ store, source, key: indexKey });

  await client.initialize();
  console.log("Initialized client for:", client.getMetadata());

  // Create tools
  const tools = createAISDKTools({ client });

  // Run agent
  console.log("\nQuery:", query);
  console.log("---");

  const result = await generateText({
    model: openai("gpt-4o"),
    tools,
    maxSteps: 10,
    system: `You are a helpful coding assistant with access to a codebase.
Use the search tool to find relevant code, then answer the user's question.
Use listFiles to explore the project structure.
Use readFile to examine specific files in detail.`,
    prompt: query,
  });

  console.log(result.text);

  // Show tool usage
  console.log("\n--- Tool calls ---");
  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      console.log(`${call.toolName}(${JSON.stringify(call.args)})`);
    }
  }
}

main().catch(console.error);
```

## Acceptance Criteria

- [ ] `npm run build` compiles without errors
- [ ] `createAISDKTools` returns valid AI SDK tools
- [ ] Tools work with `generateText` and `streamText`
- [ ] Lazy initialization defers client setup
- [ ] Tools respect source availability (no file tools without source)
- [ ] Example agent runs successfully
- [ ] All tests pass

## Testing

### `src/clients/ai-sdk-tools.test.ts`

```typescript
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
    expect(tools.listFiles).toBeUndefined();
    expect(tools.readFile).toBeUndefined();
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
    expect(tools.listFiles).toBeDefined();
    expect(tools.readFile).toBeDefined();
  });

  it("search tool executes correctly", async () => {
    const mockClient = {
      hasSource: () => false,
      getMetadata: () => ({ type: "filesystem", identifier: "/test" }),
      search: vi.fn().mockResolvedValue({ results: "found code" }),
    };

    const tools = createAISDKTools({ client: mockClient as any });
    const result = await tools.search.execute({ query: "test" }, {} as any);

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
    await tools.search.execute({ query: "test" }, {} as any);
    expect(initFn).toHaveBeenCalledTimes(1);

    // Second use reuses client
    await tools.search.execute({ query: "test2" }, {} as any);
    expect(initFn).toHaveBeenCalledTimes(1);
  });
});
```

## Notes

- AI SDK tools use Zod for parameter validation
- Tool descriptions should be clear for LLM understanding
- Consider adding `maxRetries` option for resilience
- The lazy initialization pattern is useful for serverless where you want cold starts to be fast
- Tools return strings; AI SDK handles the response formatting

