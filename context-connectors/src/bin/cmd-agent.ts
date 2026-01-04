/**
 * Agent command - Interactive AI agent for codebase Q&A
 */

import { Command } from "commander";
import * as readline from "readline";
import { SearchClient } from "../clients/search-client.js";
import { CLIAgent, type Provider } from "../clients/cli-agent.js";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";
import { getSourceIdentifier } from "../core/types.js";
import type { Source } from "../sources/types.js";

const PROVIDER_DEFAULTS: Record<Provider, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-4-5",
  google: "gemini-3-flash-preview",
};

export const agentCommand = new Command("agent")
  .description("Interactive AI agent for codebase Q&A")
  .requiredOption("-n, --name <name>", "Index name")
  .requiredOption(
    "--provider <name>",
    "LLM provider (openai, anthropic, google)"
  )
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--store-path <path>", "Store base path")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--search-only", "Disable listFiles/readFile tools (search only)")
  .option("-p, --path <path>", "Path override for filesystem source")
  .option("--model <name>", "Model to use (defaults based on provider)")
  .option("--max-steps <n>", "Maximum agent steps", (val) => parseInt(val, 10), 10)
  .option("-v, --verbose", "Show tool calls")
  .option("-q, --query <query>", "Single query (non-interactive)")
  .action(async (options) => {
    try {
      // Validate provider
      const provider = options.provider as Provider;
      if (!["openai", "anthropic", "google"].includes(provider)) {
        console.error(
          `Unknown provider: ${provider}. Use: openai, anthropic, or google`
        );
        process.exit(1);
      }

      // Get model (use provider default if not specified)
      const model = options.model ?? PROVIDER_DEFAULTS[provider];

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
      const state = await store.loadSearch(options.name);
      if (!state) {
        console.error(`Index "${options.name}" not found`);
        process.exit(1);
      }

      // Create source unless --search-only is specified
      let source: Source | undefined;
      if (!options.searchOnly) {
        const meta = state.source;
        if (meta.type === "filesystem") {
          // Allow override via --path option
          const config = options.path
            ? { ...meta.config, rootPath: options.path }
            : meta.config;
          source = new FilesystemSource(config);
        } else if (meta.type === "github") {
          const { GitHubSource } = await import("../sources/github.js");
          source = new GitHubSource(meta.config);
        } else if (meta.type === "gitlab") {
          const { GitLabSource } = await import("../sources/gitlab.js");
          source = new GitLabSource(meta.config);
        } else if (meta.type === "bitbucket") {
          const { BitBucketSource } = await import("../sources/bitbucket.js");
          source = new BitBucketSource(meta.config);
        } else if (meta.type === "website") {
          const { WebsiteSource } = await import("../sources/website.js");
          source = new WebsiteSource(meta.config);
        }
      }

      // Create client
      const client = new SearchClient({ store, source, indexName: options.name });
      await client.initialize();

      const clientMeta = client.getMetadata();
      console.log(`\x1b[36mConnected to: ${clientMeta.type}://${getSourceIdentifier(clientMeta)}\x1b[0m`);
      console.log(`\x1b[36mUsing: ${provider}/${model}\x1b[0m`);
      console.log(`\x1b[36mLast synced: ${clientMeta.syncedAt}\x1b[0m\n`);

      // Create and initialize agent
      const agent = new CLIAgent({
        client,
        provider,
        model,
        maxSteps: options.maxSteps,
        verbose: options.verbose,
      });
      await agent.initialize();

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

