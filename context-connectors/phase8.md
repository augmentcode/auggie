# Phase 8: CLI Agent

## Overview

This phase creates an interactive CLI agent that allows users to ask questions about their indexed codebase. The agent uses the AI SDK tools from Phase 7 in an agentic loop.

**Depends on**: Phase 7 complete

## Goal

Create an interactive CLI agent that:
1. Loads an indexed codebase from any store
2. Runs an agentic loop using AI SDK tools
3. Supports both interactive (REPL) and single-query modes
4. Shows tool usage for transparency
5. Works with any OpenAI-compatible model

## Prerequisites

- AI SDK tools from Phase 7
- `@ai-sdk/openai` or other AI SDK provider
- `readline` for interactive input (built into Node.js)

## Files to Create

### 1. `src/clients/cli-agent.ts`

Interactive agent implementation.

```typescript
import { generateText, streamText, CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createAISDKTools } from "./ai-sdk-tools.js";
import type { SearchClient } from "./search-client.js";

export interface CLIAgentConfig {
  client: SearchClient;
  model?: string;              // Default: "gpt-4o"
  maxSteps?: number;           // Default: 10
  verbose?: boolean;           // Show tool calls
  stream?: boolean;            // Stream responses
  systemPrompt?: string;       // Custom system prompt
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful coding assistant with access to a codebase.

Available tools:
- search: Find relevant code using natural language queries
- listFiles: List files in the project (with optional glob filter)
- readFile: Read the contents of a specific file

When answering questions:
1. Use the search tool to find relevant code
2. Use listFiles to understand project structure if needed
3. Use readFile to examine specific files in detail
4. Provide clear, actionable answers based on the actual code

Be concise but thorough. Reference specific files and line numbers when helpful.`;

export class CLIAgent {
  private readonly client: SearchClient;
  private readonly model: ReturnType<typeof openai>;
  private readonly maxSteps: number;
  private readonly verbose: boolean;
  private readonly stream: boolean;
  private readonly systemPrompt: string;
  private readonly tools: ReturnType<typeof createAISDKTools>;
  private messages: CoreMessage[] = [];

  constructor(config: CLIAgentConfig) {
    this.client = config.client;
    this.model = openai(config.model ?? "gpt-4o");
    this.maxSteps = config.maxSteps ?? 10;
    this.verbose = config.verbose ?? false;
    this.stream = config.stream ?? true;
    this.systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.tools = createAISDKTools({ client: this.client });
  }

  /**
   * Ask a single question and get a response
   */
  async ask(query: string): Promise<string> {
    this.messages.push({ role: "user", content: query });

    if (this.stream) {
      return this.streamResponse();
    } else {
      return this.generateResponse();
    }
  }

  private async generateResponse(): Promise<string> {
    const result = await generateText({
      model: this.model,
      tools: this.tools,
      maxSteps: this.maxSteps,
      system: this.systemPrompt,
      messages: this.messages,
      onStepFinish: this.verbose ? this.logStep.bind(this) : undefined,
    });

    this.messages.push({ role: "assistant", content: result.text });
    return result.text;
  }

  private async streamResponse(): Promise<string> {
    const result = streamText({
      model: this.model,
      tools: this.tools,
      maxSteps: this.maxSteps,
      system: this.systemPrompt,
      messages: this.messages,
      onStepFinish: this.verbose ? this.logStep.bind(this) : undefined,
    });

    let fullText = "";
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullText += chunk;
    }
    process.stdout.write("\n");

    this.messages.push({ role: "assistant", content: fullText });
    return fullText;
  }

  private logStep(step: { toolCalls?: Array<{ toolName: string; args: unknown }> }) {
    if (step.toolCalls) {
      for (const call of step.toolCalls) {
        console.error(`\x1b[90m[tool] ${call.toolName}(${JSON.stringify(call.args)})\x1b[0m`);
      }
    }
  }

  /**
   * Reset conversation history
   */
  reset(): void {
    this.messages = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): CoreMessage[] {
    return [...this.messages];
  }
}
```

### 2. `src/bin/cmd-agent.ts`

CLI command for running the agent.

```typescript
import { Command } from "commander";
import * as readline from "readline";
import { SearchClient } from "../clients/search-client.js";
import { CLIAgent } from "../clients/cli-agent.js";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";

const program = new Command();

program
  .command("agent")
  .description("Interactive AI agent for codebase Q&A")
  .requiredOption("-k, --key <name>", "Index key/name")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--store-path <path>", "Store base path", ".context-connectors")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--with-source", "Enable listFiles/readFile tools")
  .option("-p, --path <path>", "Path for filesystem source")
  .option("--model <name>", "OpenAI model to use", "gpt-4o")
  .option("--max-steps <n>", "Maximum agent steps", parseInt, 10)
  .option("-v, --verbose", "Show tool calls")
  .option("-q, --query <query>", "Single query (non-interactive)")
  .action(async (options) => {
    try {
      // Create store
      let store;
      if (options.store === "filesystem") {
        store = new FilesystemStore({ basePath: options.storePath });
      } else if (options.store === "s3") {
        const { S3Store } = await import("../stores/s3.js");
        store = new S3Store({ bucket: options.bucket });
      } else {
        console.error(`Unknown store type: ${options.store}`);
        process.exit(1);
      }

      // Load state for source type detection
      const state = await store.load(options.key);
      if (!state) {
        console.error(`Index "${options.key}" not found`);
        process.exit(1);
      }

      // Create source if requested
      let source;
      if (options.withSource) {
        if (state.source.type === "filesystem") {
          const path = options.path ?? state.source.identifier;
          source = new FilesystemSource({ rootPath: path });
        } else if (state.source.type === "github") {
          const [owner, repo] = state.source.identifier.split("/");
          const { GitHubSource } = await import("../sources/github.js");
          source = new GitHubSource({ owner, repo, ref: state.source.ref });
        }
      }

      // Create client
      const client = new SearchClient({ store, source, key: options.key });
      await client.initialize();

      const meta = client.getMetadata();
      console.log(`\x1b[36mConnected to: ${meta.type}://${meta.identifier}\x1b[0m`);
      console.log(`\x1b[36mLast synced: ${meta.syncedAt}\x1b[0m\n`);

      // Create agent
      const agent = new CLIAgent({
        client,
        model: options.model,
        maxSteps: options.maxSteps,
        verbose: options.verbose,
      });

      // Single query mode
      if (options.query) {
        await agent.ask(options.query);
        return;
      }

      // Interactive mode
      console.log("Ask questions about your codebase. Type 'exit' to quit.\n");

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const prompt = () => {
        rl.question("\x1b[32m> \x1b[0m", async (input) => {
          const query = input.trim();

          if (query.toLowerCase() === "exit" || query.toLowerCase() === "quit") {
            rl.close();
            return;
          }

          if (query.toLowerCase() === "reset") {
            agent.reset();
            console.log("Conversation reset.\n");
            prompt();
            return;
          }

          if (!query) {
            prompt();
            return;
          }

          try {
            console.log();
            await agent.ask(query);
            console.log();
          } catch (error) {
            console.error("\x1b[31mError:\x1b[0m", error);
          }

          prompt();
        });
      };

      prompt();

    } catch (error) {
      console.error("Agent failed:", error);
      process.exit(1);
    }
  });

export { program };
```

### 3. Update `src/bin/index.ts`

Import the agent command:

```typescript
import "./cmd-agent.js";
```

### 4. Update `src/clients/index.ts`

Export CLIAgent:

```typescript
export { CLIAgent, type CLIAgentConfig } from "./cli-agent.js";
```

## Acceptance Criteria

- [ ] `npm run build` compiles without errors
- [ ] `npm run cli agent -k <key> -q "question"` returns an answer
- [ ] Interactive mode works with readline
- [ ] Verbose mode shows tool calls
- [ ] Streaming shows tokens as they arrive
- [ ] `reset` command clears conversation
- [ ] Agent uses tools appropriately
- [ ] All tests pass

## Testing

### `src/clients/cli-agent.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CLIAgent } from "./cli-agent.js";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-model"),
}));

describe("CLIAgent", () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      hasSource: vi.fn().mockReturnValue(true),
      getMetadata: vi.fn().mockReturnValue({ type: "filesystem", identifier: "/test" }),
      search: vi.fn(),
      listFiles: vi.fn(),
      readFile: vi.fn(),
    };
  });

  it("creates agent with defaults", () => {
    const agent = new CLIAgent({ client: mockClient });
    expect(agent).toBeDefined();
  });

  it("resets conversation history", () => {
    const agent = new CLIAgent({ client: mockClient });
    agent.reset();
    expect(agent.getHistory()).toHaveLength(0);
  });

  it("uses custom model", () => {
    const agent = new CLIAgent({
      client: mockClient,
      model: "gpt-3.5-turbo",
    });
    expect(agent).toBeDefined();
  });

  it("uses custom system prompt", () => {
    const agent = new CLIAgent({
      client: mockClient,
      systemPrompt: "Custom prompt",
    });
    expect(agent).toBeDefined();
  });
});
```

### Manual Testing

```bash
# Single query
npm run cli agent -k myproject -q "What does this project do?"

# Interactive mode
npm run cli agent -k myproject --with-source -p .

# Verbose mode (shows tool calls)
npm run cli agent -k myproject -v -q "Find the main entry point"

# Different model
npm run cli agent -k myproject --model gpt-3.5-turbo -q "Hello"
```

## CLI Usage Examples

```bash
# Basic interactive mode
context-connectors agent -k my-project

# With source for file operations
context-connectors agent -k my-project --with-source -p /path/to/project

# Single question (non-interactive)
context-connectors agent -k my-project -q "How does authentication work?"

# Verbose mode to see tool usage
context-connectors agent -k my-project -v -q "Find all API routes"

# Use faster model
context-connectors agent -k my-project --model gpt-4o-mini -q "Summarize this project"

# With S3 store
context-connectors agent -k my-project --store s3 --bucket my-indexes -q "List main features"
```

## Notes

- Requires `OPENAI_API_KEY` environment variable
- Consider supporting other AI providers (`@ai-sdk/anthropic`, etc.)
- The agent maintains conversation history for follow-up questions
- Tool calls logged to stderr so they don't interfere with output parsing
- Colors use ANSI escape codes (may need `--no-color` flag for CI)
- Consider adding `--json` output for programmatic use

