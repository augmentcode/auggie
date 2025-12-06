/**
 * Sample: Direct Context - API-based indexing with import/export state
 *
 * This sample demonstrates:
 * - Creating a Direct Context instance
 * - Adding files to the index
 * - Searching the indexed files
 * - Using Generation API to ask questions about indexed code
 * - Generating documentation from indexed code
 * - Exporting state to a file
 * - Importing state from a file
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DirectContext } from "@augmentcode/auggie-sdk";

/**
 * Retry a search operation with exponential backoff
 * This helps handle intermittent API failures
 */
async function searchWithRetry(
  context: DirectContext,
  query: string,
  maxRetries = 3
): Promise<string> {
  const RETRY_MESSAGE = "Retrieval failed. Please try again.";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await context.search(query);

    // Check if the result indicates a failure
    if (result.includes(RETRY_MESSAGE)) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`  ⚠️  Search failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        console.log(`  ❌ Search failed after ${maxRetries} attempts`);
        return result; // Return the failure message
      }
    }

    // Success
    if (attempt > 1) {
      console.log(`  ✅ Search succeeded on attempt ${attempt}`);
    }
    return result;
  }

  return RETRY_MESSAGE;
}

/**
 * Retry a searchAndAsk operation with exponential backoff
 */
async function searchAndAskWithRetry(
  context: DirectContext,
  searchQuery: string,
  prompt: string,
  maxRetries = 3
): Promise<string> {
  const RETRY_MESSAGE = "Retrieval failed. Please try again.";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await context.searchAndAsk(searchQuery, prompt);

    // Check if the result indicates a search failure
    if (result.includes(RETRY_MESSAGE)) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`  ⚠️  Search failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        console.log(`  ❌ Search failed after ${maxRetries} attempts`);
        return result; // Return the failure message
      }
    }

    // Success
    if (attempt > 1) {
      console.log(`  ✅ Search succeeded on attempt ${attempt}`);
    }
    return result;
  }

  return RETRY_MESSAGE;
}

async function main() {
  console.log("=== Direct Context Sample ===\n");

  // Create a Direct Context instance
  // Authentication is automatic via:
  // 1. AUGMENT_API_TOKEN / AUGMENT_API_URL env vars, or
  // 2. ~/.augment/session.json (created by `auggie login`)
  console.log("Creating Direct Context...");
  const context = await DirectContext.create({ debug: true });

  // Add some sample files to the index
  console.log("\nAdding files to index...");
  const files = [
    {
      path: "sample/calculator.ts",
      contents: `export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error("Division by zero");
    return a / b;
  }
}`,
    },
    {
      path: "sample/utils.ts",
      contents: `export function formatNumber(num: number): string {
  return num.toLocaleString();
}

export function isEven(num: number): boolean {
  return num % 2 === 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}`,
    },
    {
      path: "sample/main.ts",
      contents: `import { Calculator } from "./calculator";
import { formatNumber } from "./utils";

const calc = new Calculator();
const result = calc.add(10, 20);
console.log("Result:", formatNumber(result));`,
    },
  ];

  const result = await context.addToIndex(files);
  console.log("\nIndexing result:");
  console.log("  Newly indexed:", result.newlyIndexed);
  console.log("  Already indexed:", result.alreadyIndexed);

  // Search the codebase - returns formatted string ready for LLM use or display
  console.log("\n--- Search 1: Find calculator functions ---");
  const results1 = await searchWithRetry(context, "calculator functions for arithmetic");
  console.log("Search results:");
  console.log(results1);

  console.log("\n--- Search 2: Find utility functions ---");
  const results2 = await searchWithRetry(context, "utility functions");
  console.log("Search results:");
  console.log(results2);

  // Use searchAndAsk to ask questions about the indexed code
  console.log("\n--- searchAndAsk Example 1: Ask questions about the code ---");
  const question = "How does the Calculator class handle division by zero?";
  console.log(`Question: ${question}`);

  const answer = await searchAndAskWithRetry(
    context,
    "division by zero error handling",
    question
  );

  console.log(`\nAnswer: ${answer}`);

  // Use searchAndAsk to generate documentation
  console.log("\n--- searchAndAsk Example 2: Generate documentation ---");
  const documentation = await searchAndAskWithRetry(
    context,
    "Calculator class methods",
    "Generate API documentation in markdown format for this code"
  );

  console.log("\nGenerated Documentation:");
  console.log(documentation);

  // Use searchAndAsk to explain code patterns
  console.log("\n--- searchAndAsk Example 3: Explain code patterns ---");
  const explanation = await searchAndAskWithRetry(
    context,
    "utility functions",
    "Explain what these utility functions do and when they would be useful"
  );

  console.log(`\nExplanation: ${explanation}`);

  // Export state to a file
  const stateFile = join("/tmp", "direct-context-state.json");
  console.log(`\nExporting state to ${stateFile}...`);
  await context.exportToFile(stateFile);
  console.log("State exported successfully");

  // Show the exported state
  const exportedState = JSON.parse(readFileSync(stateFile, "utf-8"));
  console.log("\nExported state:");
  console.log(JSON.stringify(exportedState, null, 2));

  // Import state in a new context
  console.log("\n--- Testing state import ---");
  const context2 = await DirectContext.importFromFile(stateFile, { debug: false });
  console.log("State imported successfully");

  // Verify we can still search
  const results3 = await searchWithRetry(context2, "division by zero");
  console.log("\nSearch after importing state:");
  console.log(results3);

  console.log("\n=== Sample Complete ===");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
