#!/usr/bin/env node
/**
 * Main entry point for GitHub Action Indexer
 */

import { DirectContext } from "@augmentcode/auggie-sdk";
import { IndexManager } from "./index-manager.js";
import type { IndexConfig } from "./types.js";

/**
 * Get API credentials from environment variables
 */
function getApiCredentials(): { apiToken: string; apiUrl: string } {
  const apiToken = process.env.AUGMENT_API_TOKEN;
  if (!apiToken) {
    throw new Error("AUGMENT_API_TOKEN environment variable is required");
  }

  const apiUrl = process.env.AUGMENT_API_URL;
  if (!apiUrl) {
    throw new Error(
      "AUGMENT_API_URL environment variable is required. Please set it to your tenant-specific URL (e.g., 'https://your-tenant.api.augmentcode.com/')"
    );
  }

  return { apiToken, apiUrl };
}

/**
 * Parse repository information from environment variables
 */
function parseRepositoryInfo(): {
  owner: string;
  repo: string;
  branch: string;
  currentCommit: string;
} {
  const repository = process.env.GITHUB_REPOSITORY || "";
  const [owner, repo] = repository.split("/");

  if (!(owner && repo)) {
    throw new Error('GITHUB_REPOSITORY must be in format "owner/repo"');
  }

  // Extract branch name from GitHub ref
  const githubRef = process.env.GITHUB_REF || "";
  const githubRefName = process.env.GITHUB_REF_NAME || "";

  let branch: string;
  if (githubRef.startsWith("refs/heads/")) {
    branch = githubRefName;
  } else if (githubRef.startsWith("refs/tags/")) {
    branch = `tag/${githubRefName}`;
  } else if (githubRefName) {
    branch = githubRefName;
  } else {
    branch = process.env.BRANCH || "main";
  }

  const currentCommit = process.env.GITHUB_SHA || "";
  if (!currentCommit) {
    throw new Error("GITHUB_SHA environment variable is required");
  }

  return { owner, repo, branch, currentCommit };
}

/**
 * Load configuration from environment variables
 */
function loadConfig(): IndexConfig {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  const { apiToken, apiUrl } = getApiCredentials();
  const { owner, repo, branch, currentCommit } = parseRepositoryInfo();

  return {
    apiToken,
    apiUrl,
    githubToken,
    owner,
    repo,
    branch,
    currentCommit,
    maxCommits: process.env.MAX_COMMITS
      ? Number.parseInt(process.env.MAX_COMMITS, 10)
      : undefined,
    maxFiles: process.env.MAX_FILES
      ? Number.parseInt(process.env.MAX_FILES, 10)
      : undefined,
  };
}

/**
 * Get the state file path for the current branch
 */
function getStatePath(branch: string): string {
  const sanitizedBranch = branch.replace(/[^a-zA-Z0-9-_]/g, "-");
  return (
    process.env.STATE_PATH ||
    `.augment-index-state/${sanitizedBranch}/state.json`
  );
}

/**
 * Main function
 */
async function main() {
  console.log("GitHub Action Indexer - Starting...");

  try {
    // Load configuration
    const config = loadConfig();
    const statePath = getStatePath(config.branch);

    console.log(`Repository: ${config.owner}/${config.repo}`);
    console.log(`Branch: ${config.branch}`);
    console.log(`Commit ref: ${config.currentCommit}`);
    console.log(`State path: ${statePath}`);

    // Create DirectContext
    const context = await DirectContext.create({
      apiKey: config.apiToken,
      apiUrl: config.apiUrl,
    });

    // Create index manager and resolve commit SHA
    const manager = new IndexManager(context, config, statePath);
    await manager.resolveCommitSha();

    console.log(`Resolved commit SHA: ${config.currentCommit}`);

    // Perform indexing
    const result = await manager.index();

    // Print results
    console.log("\n=== Indexing Results ===");
    console.log(`Success: ${result.success}`);
    console.log(`Type: ${result.type}`);
    console.log(`Files Indexed: ${result.filesIndexed}`);
    console.log(`Files Deleted: ${result.filesDeleted}`);
    console.log(`Checkpoint ID: ${result.checkpointId}`);
    console.log(`Commit SHA: ${result.commitSha}`);

    if (result.reindexReason) {
      console.log(`Re-index Reason: ${result.reindexReason}`);
    }

    if (result.error) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    // Set GitHub Actions output
    if (process.env.GITHUB_OUTPUT) {
      const fs = await import("node:fs");
      const output = [
        `success=${result.success}`,
        `type=${result.type}`,
        `files_indexed=${result.filesIndexed}`,
        `files_deleted=${result.filesDeleted}`,
        `checkpoint_id=${result.checkpointId}`,
        `commit_sha=${result.commitSha}`,
      ].join("\n");

      await fs.promises.appendFile(process.env.GITHUB_OUTPUT, `${output}\n`);
    }

    console.log("\nIndexing completed successfully!");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run main function
main();
