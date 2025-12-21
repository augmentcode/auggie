/**
 * CLI Agent - Interactive AI agent for codebase Q&A.
 *
 * Uses AI SDK tools in an agentic loop for answering questions about
 * indexed codebases. Supports multiple LLM providers and both
 * interactive (REPL) and single-query modes.
 *
 * @module clients/cli-agent
 *
 * @example
 * ```typescript
 * import { CLIAgent } from "@augmentcode/context-connectors";
 *
 * const agent = new CLIAgent({
 *   client: searchClient,
 *   provider: "openai",
 *   model: "gpt-4o",
 * });
 * await agent.initialize();
 *
 * const response = await agent.ask("How does authentication work?");
 * console.log(response);
 * ```
 */

import {
  generateText,
  streamText,
  CoreMessage,
  ToolSet,
  stepCountIs,
  LanguageModel,
  tool,
} from "ai";
import { z } from "zod";
import type { SearchClient } from "./search-client.js";

/**
 * Supported LLM providers.
 * Each requires its corresponding AI SDK provider package to be installed.
 */
export type Provider = "openai" | "anthropic" | "google";

/**
 * Configuration for the CLI agent.
 */
export interface CLIAgentConfig {
  /** Initialized SearchClient instance */
  client: SearchClient;
  /** LLM provider to use */
  provider: Provider;
  /** Model name (e.g., "gpt-4o", "claude-3-opus", "gemini-pro") */
  model: string;
  /**
   * Maximum number of agent steps (tool calls + responses).
   * @default 10
   */
  maxSteps?: number;
  /**
   * Log tool calls to stderr for debugging.
   * @default false
   */
  verbose?: boolean;
  /**
   * Stream responses token by token.
   * @default true
   */
  stream?: boolean;
  /** Custom system prompt. Uses a sensible default if not provided. */
  systemPrompt?: string;
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

/**
 * Load a model from the specified provider.
 * Provider packages are optional - users only need to install the one they use.
 */
async function loadModel(
  provider: Provider,
  modelName: string
): Promise<LanguageModel> {
  switch (provider) {
    case "openai": {
      try {
        const { openai } = await import("@ai-sdk/openai");
        // Use openai.chat() instead of openai() to use the Chat Completions API
        // rather than the Responses API. The Responses API is stateful and doesn't
        // work with Zero Data Retention (ZDR) organizations because function call
        // IDs (fc_...) are not persisted server-side.
        return openai.chat(modelName);
      } catch {
        throw new Error(
          `OpenAI provider not installed. Run: npm install @ai-sdk/openai`
        );
      }
    }
    case "anthropic": {
      try {
        const { anthropic } = await import("@ai-sdk/anthropic");
        return anthropic(modelName);
      } catch {
        throw new Error(
          `Anthropic provider not installed. Run: npm install @ai-sdk/anthropic`
        );
      }
    }
    case "google": {
      try {
        const { google } = await import("@ai-sdk/google");
        return google(modelName);
      } catch {
        throw new Error(
          `Google provider not installed. Run: npm install @ai-sdk/google`
        );
      }
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Interactive AI agent for codebase Q&A.
 *
 * The agent maintains conversation history, allowing for follow-up
 * questions. It uses the configured LLM to answer questions by
 * automatically calling search, listFiles, and readFile tools.
 *
 * @example
 * ```typescript
 * const agent = new CLIAgent({
 *   client: searchClient,
 *   provider: "openai",
 *   model: "gpt-4o",
 *   verbose: true, // Show tool calls
 * });
 *
 * await agent.initialize();
 *
 * // Ask questions
 * await agent.ask("What does this project do?");
 * await agent.ask("Show me the main entry point");
 *
 * // Reset for new conversation
 * agent.reset();
 * ```
 */
export class CLIAgent {
  private readonly client: SearchClient;
  private model: LanguageModel | null = null;
  private readonly provider: Provider;
  private readonly modelName: string;
  private readonly maxSteps: number;
  private readonly verbose: boolean;
  private readonly stream: boolean;
  private readonly systemPrompt: string;
  private readonly tools: ToolSet;
  private messages: CoreMessage[] = [];

  /**
   * Create a new CLI agent.
   *
   * Note: You must call `initialize()` before using the agent.
   *
   * @param config - Agent configuration
   */
  constructor(config: CLIAgentConfig) {
    this.client = config.client;
    this.provider = config.provider;
    this.modelName = config.model;
    this.maxSteps = config.maxSteps ?? 10;
    this.verbose = config.verbose ?? false;
    this.stream = config.stream ?? true;
    this.systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.tools = this.createTools();
  }

  /**
   * Create AI SDK tools for the SearchClient.
   */
  private createTools(): ToolSet {
    const client = this.client;
    const hasSource = client.hasSource();

    const searchSchema = z.object({
      query: z.string().describe("Natural language search query describing what you're looking for"),
      maxChars: z.number().optional().describe("Maximum characters in response"),
    });

    const searchTool = tool({
      description: "Search the codebase using natural language. Returns relevant code snippets and file paths.",
      inputSchema: searchSchema,
      execute: async ({ query, maxChars }: z.infer<typeof searchSchema>) => {
        const result = await client.search(query, { maxOutputLength: maxChars });
        return result.results || "No results found.";
      },
    });

    if (hasSource) {
      const listFilesSchema = z.object({
        directory: z.string().optional().describe("Directory to list (default: root). Only immediate children are returned."),
        pattern: z.string().optional().describe("Glob pattern to filter results (e.g., '*.ts', '*.json')"),
      });

      const listFilesTool = tool({
        description: "List files and directories in a specific directory (non-recursive). Use multiple calls to explore subdirectories.",
        inputSchema: listFilesSchema,
        execute: async ({ directory, pattern }: z.infer<typeof listFilesSchema>) => {
          const entries = await client.listFiles({ directory, pattern });
          return entries.map(e => `${e.path} [${e.type}]`).join("\n");
        },
      });

      const readFileSchema = z.object({
        path: z.string().describe("Path to the file to read"),
      });

      const readFileTool = tool({
        description: "Read the contents of a specific file from the codebase.",
        inputSchema: readFileSchema,
        execute: async ({ path }: z.infer<typeof readFileSchema>) => {
          const result = await client.readFile(path);
          if (result.error) {
            return `Error: ${result.error}`;
          }
          return result.contents ?? "";
        },
      });

      return {
        search: searchTool,
        listFiles: listFilesTool,
        readFile: readFileTool,
      } as ToolSet;
    }

    return {
      search: searchTool,
    } as ToolSet;
  }

  /**
   * Initialize the agent by loading the model from the provider.
   *
   * Must be called before using `ask()`.
   *
   * @throws Error if the provider package is not installed
   */
  async initialize(): Promise<void> {
    this.model = await loadModel(this.provider, this.modelName);
  }

  /**
   * Ask a question and get a response.
   *
   * The response is generated by the LLM, which may call tools
   * (search, listFiles, readFile) to gather information before
   * answering.
   *
   * The question and response are added to conversation history,
   * enabling follow-up questions.
   *
   * @param query - The question to ask
   * @returns The agent's response text
   * @throws Error if agent not initialized
   *
   * @example
   * ```typescript
   * const response = await agent.ask("How is authentication implemented?");
   * console.log(response);
   * ```
   */
  async ask(query: string): Promise<string> {
    if (!this.model) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    this.messages.push({ role: "user", content: query });

    if (this.stream) {
      return this.streamResponse();
    } else {
      return this.generateResponse();
    }
  }

  private async generateResponse(): Promise<string> {
    const result = await generateText({
      model: this.model!,
      tools: this.tools,
      stopWhen: stepCountIs(this.maxSteps),
      system: this.systemPrompt,
      messages: this.messages,
      onStepFinish: this.verbose ? this.logStep.bind(this) : undefined,
    });

    this.messages.push({ role: "assistant", content: result.text });
    return result.text;
  }

  private async streamResponse(): Promise<string> {
    const result = streamText({
      model: this.model!,
      tools: this.tools,
      stopWhen: stepCountIs(this.maxSteps),
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

  private logStep(step: {
    toolCalls?: Array<{ toolName: string; args?: unknown }>;
  }) {
    if (step.toolCalls) {
      for (const call of step.toolCalls) {
        console.error(
          `\x1b[90m[tool] ${call.toolName}(${JSON.stringify(call.args ?? {})})\x1b[0m`
        );
      }
    }
  }

  /**
   * Reset conversation history.
   *
   * Use this to start a fresh conversation without tool context
   * from previous questions.
   */
  reset(): void {
    this.messages = [];
  }

  /**
   * Get a copy of the conversation history.
   *
   * @returns Array of messages (user and assistant turns)
   */
  getHistory(): CoreMessage[] {
    return [...this.messages];
  }
}

