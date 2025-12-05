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
  const results1 = await context.search("calculator functions for arithmetic");
  console.log("Search results:");
  console.log(results1);

  console.log("\n--- Search 2: Find utility functions ---");
  const results2 = await context.search("utility functions");
  console.log("Search results:");
  console.log(results2);

  // Use searchAndAsk to ask questions about the indexed code
  console.log("\n--- searchAndAsk Example 1: Ask questions about the code ---");
  const question = "How does the Calculator class handle division by zero?";
  console.log(`Question: ${question}`);

  const answer = await context.searchAndAsk(
    "division by zero error handling",
    question
  );

  console.log(`\nAnswer: ${answer}`);

  // Use searchAndAsk to generate documentation
  console.log("\n--- searchAndAsk Example 2: Generate documentation ---");
  const documentation = await context.searchAndAsk(
    "Calculator class methods",
    "Generate API documentation in markdown format for this code"
  );

  console.log("\nGenerated Documentation:");
  console.log(documentation);

  // Use searchAndAsk to explain code patterns
  console.log("\n--- searchAndAsk Example 3: Explain code patterns ---");
  const explanation = await context.searchAndAsk(
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
  const context2 = await DirectContext.create({ debug: false });
  await context2.importFromFile(stateFile);
  console.log("State imported successfully");

  // Verify we can still search
  const results3 = await context2.search("division by zero");
  console.log("\nSearch after importing state:");
  console.log(results3);

  console.log("\n=== Sample Complete ===");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
