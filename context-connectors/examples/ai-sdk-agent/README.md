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

