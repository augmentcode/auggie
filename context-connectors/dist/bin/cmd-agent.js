/**
 * Agent command - Interactive AI agent for codebase Q&A
 */
import { Command } from "commander";
import * as readline from "readline";
import { SearchClient } from "../clients/search-client.js";
import { CLIAgent } from "../clients/cli-agent.js";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";
const PROVIDER_DEFAULTS = {
    openai: "gpt-5.2",
    anthropic: "claude-sonnet-4-5",
    google: "gemini-3-pro",
};
export const agentCommand = new Command("agent")
    .description("Interactive AI agent for codebase Q&A")
    .requiredOption("-k, --key <name>", "Index key/name")
    .requiredOption("--provider <name>", "LLM provider (openai, anthropic, google)")
    .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
    .option("--store-path <path>", "Store base path", ".context-connectors")
    .option("--bucket <name>", "S3 bucket name (for s3 store)")
    .option("--with-source", "Enable listFiles/readFile tools")
    .option("-p, --path <path>", "Path for filesystem source")
    .option("--model <name>", "Model to use (defaults based on provider)")
    .option("--max-steps <n>", "Maximum agent steps", (val) => parseInt(val, 10), 10)
    .option("-v, --verbose", "Show tool calls")
    .option("-q, --query <query>", "Single query (non-interactive)")
    .action(async (options) => {
    try {
        // Validate provider
        const provider = options.provider;
        if (!["openai", "anthropic", "google"].includes(provider)) {
            console.error(`Unknown provider: ${provider}. Use: openai, anthropic, or google`);
            process.exit(1);
        }
        // Get model (use provider default if not specified)
        const model = options.model ?? PROVIDER_DEFAULTS[provider];
        // Create store
        let store;
        if (options.store === "filesystem") {
            store = new FilesystemStore({ basePath: options.storePath });
        }
        else if (options.store === "s3") {
            const { S3Store } = await import("../stores/s3.js");
            store = new S3Store({ bucket: options.bucket });
        }
        else {
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
            }
            else if (state.source.type === "github") {
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
        console.log(`\x1b[36mUsing: ${provider}/${model}\x1b[0m`);
        console.log(`\x1b[36mLast synced: ${meta.syncedAt}\x1b[0m\n`);
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
                }
                catch (error) {
                    console.error("\x1b[31mError:\x1b[0m", error);
                }
                prompt();
            });
        };
        prompt();
    }
    catch (error) {
        console.error("Agent failed:", error);
        process.exit(1);
    }
});
//# sourceMappingURL=cmd-agent.js.map