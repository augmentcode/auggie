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

