/**
 * Sample: FileSystem Context - Local directory retrieval via MCP
 *
 * This sample demonstrates:
 * - Creating a FileSystem Context instance
 * - Searching a local directory using MCP protocol
 * - Getting formatted search results
 * - Interactive Q&A about the workspace using AI
 * - Code review suggestions using AI
 * - Properly closing the MCP connection
 */

import { FileSystemContext } from "@augmentcode/auggie-sdk";

async function main() {
  console.log("=== FileSystem Context Sample ===\n");

  // Use the current SDK directory as the workspace
  const workspaceDir = process.cwd();
  console.log(`Workspace directory: ${workspaceDir}`);

  // Create a FileSystem Context instance
  // Authentication is handled automatically by the auggie CLI via:
  // 1. AUGMENT_API_TOKEN / AUGMENT_API_URL env vars, or
  // 2. ~/.augment/session.json (created by `auggie login`)
  console.log("\nCreating FileSystem Context (spawning auggie --mcp)...");
  const context = await FileSystemContext.create({
    directory: workspaceDir,
    auggiePath: "auggie", // or specify full path to auggie binary
    debug: true,
  });

  try {
    // Search 1: Find TypeScript SDK implementation
    console.log("\n--- Search 1: TypeScript SDK implementation ---");
    const results1 = await context.search("TypeScript SDK implementation");
    console.log("Search results:");
    console.log(results1.substring(0, 500)); // Show first 500 chars
    if (results1.length > 500) {
      console.log(`... (${results1.length - 500} more characters)`);
    }

    // Search 2: Find context modes
    console.log("\n--- Search 2: Context modes implementation ---");
    const results2 = await context.search("context modes implementation");
    console.log("Search results:");
    console.log(results2.substring(0, 500)); // Show first 500 chars
    if (results2.length > 500) {
      console.log(`... (${results2.length - 500} more characters)`);
    }

    // searchAndAsk Example 1: Ask questions about the workspace
    console.log("\n--- searchAndAsk Example 1: Ask about context modes ---");
    const question1 = "What context modes are available in this SDK?";
    console.log(`Question: ${question1}`);
    const answer1 = await context.searchAndAsk("context modes", question1);
    console.log(`\nAnswer: ${answer1}`);

    // searchAndAsk Example 2: Ask about implementation
    console.log("\n--- searchAndAsk Example 2: Ask about generation API ---");
    const question2 = "How is the generation API implemented?";
    console.log(`Question: ${question2}`);
    const answer2 = await context.searchAndAsk(
      "generation API implementation",
      question2
    );
    console.log(`\nAnswer: ${answer2}`);

    // searchAndAsk Example 3: Code review
    console.log("\n--- searchAndAsk Example 3: Code review ---");
    const reviewFile = "src/index.ts";
    console.log(`Reviewing: ${reviewFile}`);
    const review = await context.searchAndAsk(
      `file:${reviewFile}`,
      "Review this code for potential issues, bugs, and improvements. Provide specific, actionable feedback."
    );
    console.log(`\nReview:\n${review}`);

    // searchAndAsk Example 4: Explain patterns
    console.log("\n--- searchAndAsk Example 4: Explain code patterns ---");
    const pattern = "error handling";
    console.log(`Pattern: ${pattern}`);
    const patternExplanation = await context.searchAndAsk(
      pattern,
      `Explain this code pattern: "${pattern}". What does it do, why is it used, and what are the best practices?`
    );
    console.log(`\nExplanation:\n${patternExplanation}`);
  } finally {
    // Always close the MCP connection
    console.log("\nClosing MCP connection...");
    await context.close();
    console.log("MCP connection closed");
  }

  console.log("\n=== Sample Complete ===");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
