/**
 * Agent command - Interactive AI agent for codebase Q&A
 */

import { Command } from "commander";
import * as readline from "readline";
import { CLIAgent, type Provider } from "../clients/cli-agent.js";
import { MultiIndexRunner } from "../clients/multi-index-runner.js";
import { CompositeStoreReader, parseIndexSpecs } from "../stores/index.js";

const PROVIDER_DEFAULTS: Record<Provider, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-4-5",
  google: "gemini-3-flash-preview",
};

export const agentCommand = new Command("agent")
  .description("Interactive AI agent for codebase Q&A")
  .requiredOption(
    "-i, --index <specs...>",
    "Index spec(s): name, path:/path, or s3://bucket/key"
  )
  .requiredOption(
    "--provider <name>",
    "LLM provider (openai, anthropic, google)"
  )
  .option("--search-only", "Disable listFiles/readFile tools (search only)")
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

      // Parse index specs and create composite store
      const specs = parseIndexSpecs(options.index);
      const store = await CompositeStoreReader.fromSpecs(specs);

      // Create multi-index runner
      const runner = await MultiIndexRunner.create({
        store,
        searchOnly: options.searchOnly,
      });

      // Display connected indexes
      console.log(`\x1b[36mConnected to ${runner.indexes.length} index(es):\x1b[0m`);
      for (const idx of runner.indexes) {
        console.log(`  - ${idx.name} (${idx.type}://${idx.identifier})`);
      }
      console.log(`\x1b[36mUsing: ${provider}/${model}\x1b[0m\n`);

      // Create and initialize agent with multi-index runner
      const agent = new CLIAgent({
        runner,
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

