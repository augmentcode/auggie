#!/usr/bin/env node
/**
 * CLI tool to search the indexed repository
 *
 * Usage:
 *   npm run search "your search query"
 *   tsx src/search.ts "your search query"
 */

import { promises as fs } from "node:fs";
import { DirectContext } from "@augmentcode/auggie-sdk";
import type { IndexState } from "./types.js";

/**
 * Get the state file path for the current branch
 */
function getStatePath(): string {
  const branch = process.env.BRANCH || "main";
  const sanitizedBranch = branch.replace(/[^a-zA-Z0-9-_]/g, "-");
  return (
    process.env.STATE_PATH ||
    `.augment-index-state/${sanitizedBranch}/state.json`
  );
}

/**
 * Load index state from file system
 */
async function loadState(statePath: string): Promise<IndexState | null> {
  try {
    const data = await fs.readFile(statePath, "utf-8");
    return JSON.parse(data) as IndexState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Main search function
 */
async function main(): Promise<void> {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let query: string | undefined;
  let maxOutputLength: number | undefined;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--max-chars") {
      const maxCharsValue = args[i + 1];
      if (!maxCharsValue || Number.isNaN(Number(maxCharsValue))) {
        console.error("Error: --max-chars requires a numeric value");
        console.error('Example: npm run search "query" --max-chars 5000');
        process.exit(1);
      }
      maxOutputLength = Number.parseInt(maxCharsValue, 10);
      i++; // Skip the next argument since we consumed it
    } else if (!query) {
      query = arg;
    }
  }

  if (!query) {
    console.error("Usage: npm run search <query> [--max-chars <number>]");
    console.error('Example: npm run search "authentication functions"');
    console.error(
      'Example: npm run search "authentication functions" --max-chars 5000'
    );
    process.exit(1);
  }

  // Get API token
  const apiTokenEnv = process.env.AUGMENT_API_TOKEN;
  if (!apiTokenEnv) {
    console.error("Error: AUGMENT_API_TOKEN environment variable is required");
    process.exit(1);
  }

  // Parse API token - it can be either a JSON object or a plain string
  let apiToken: string;
  let apiUrl: string | undefined = process.env.AUGMENT_API_URL;

  try {
    const tokenObj = JSON.parse(apiTokenEnv) as {
      accessToken?: string;
      tenantURL?: string;
    };
    if (tokenObj.accessToken) {
      apiToken = tokenObj.accessToken;
      // Use tenantURL from token if not overridden by env var
      if (!apiUrl && tokenObj.tenantURL) {
        apiUrl = tokenObj.tenantURL;
      }
    } else {
      apiToken = apiTokenEnv;
    }
  } catch {
    // Not JSON, use as-is
    apiToken = apiTokenEnv;
  }

  if (!apiUrl) {
    console.error(
      "Error: AUGMENT_API_URL environment variable is required. Please set it to your tenant-specific URL (e.g., 'https://your-tenant.api.augmentcode.com') or include tenantURL in your API token JSON."
    );
    process.exit(1);
  }

  console.log(`Searching for: "${query}"`);
  if (maxOutputLength !== undefined) {
    console.log(`Limiting results to max ${maxOutputLength} characters\n`);
  } else {
    console.log();
  }

  try {
    // Load the index state first
    const statePath = getStatePath();
    console.log(`Loading index state from: ${statePath}`);
    const state = await loadState(statePath);

    if (!state) {
      console.error("Error: No index state found. Run indexing first.");
      console.error("  npm run index");
      process.exit(1);
    }

    // Create a temporary file with the context state for import
    const tempStateFile = `/tmp/github-indexer-state-${Date.now()}.json`;
    await fs.writeFile(tempStateFile, JSON.stringify(state.contextState, null, 2));

    // Import state using DirectContext.importFromFile
    const context = await DirectContext.importFromFile(tempStateFile, { apiKey: apiToken, apiUrl });

    // Clean up temporary file
    await fs.unlink(tempStateFile);

    const fileCount = state.contextState.blobs
      ? state.contextState.blobs.length
      : 0;

    console.log(`Loaded index: ${fileCount} files indexed`);
    console.log(
      `Repository: ${state.repository.owner}/${state.repository.name}`
    );
    console.log(`Last indexed commit: ${state.lastCommitSha}\n`);

    // Perform search with optional character limit
    // search returns a formatted string ready for display or LLM use
    const results = await context.search(query, { maxOutputLength });

    if (!results || results.trim().length === 0) {
      console.log("No results found.");
      return;
    }

    console.log("Search results:\n");
    console.log(results);
  } catch (error) {
    console.error("Search failed:", error);
    process.exit(1);
  }
}

main();
