/**
 * Index command - Index a data source
 */

import { Command } from "commander";
import { Indexer } from "../core/indexer.js";
import { Source } from "../sources/types.js";
import { FilesystemSource } from "../sources/filesystem.js";
import { FilesystemStore } from "../stores/filesystem.js";

// Shared store options
interface StoreOptions {
  name?: string;
  store: string;
  storePath?: string;
  bucket?: string;
  s3Prefix: string;
  s3Region?: string;
  s3Endpoint?: string;
  s3ForcePathStyle?: boolean;
}

function addStoreOptions(cmd: Command): Command {
  return cmd
    .option("-n, --name <name>", "Index name (subdirectory within store path)")
    .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
    .option("--store-path <path>", "Store base path (files stored directly here if no --name)")
    .option("--bucket <name>", "S3 bucket name (required for s3 store)")
    .option("--s3-prefix <prefix>", "S3 key prefix", "context-connectors/")
    .option("--s3-region <region>", "S3 region")
    .option("--s3-endpoint <url>", "S3-compatible endpoint URL")
    .option("--s3-force-path-style", "Use path-style S3 URLs");
}

/**
 * Create a store based on options.
 */
async function createStore(options: StoreOptions) {
  if (options.store === "filesystem") {
    return new FilesystemStore({ basePath: options.storePath });
  } else if (options.store === "s3") {
    if (!options.bucket) {
      console.error("S3 store requires --bucket option");
      process.exit(1);
    }
    const { S3Store } = await import("../stores/s3.js");
    return new S3Store({
      bucket: options.bucket,
      prefix: options.s3Prefix,
      region: options.s3Region,
      endpoint: options.s3Endpoint,
      forcePathStyle: options.s3ForcePathStyle,
    });
  } else {
    console.error(`Unknown store type: ${options.store}`);
    process.exit(1);
  }
}

async function runIndex(
  source: Source,
  store: Awaited<ReturnType<typeof createStore>>,
  name: string,
  sourceType: string
) {
  console.log(`Indexing ${sourceType} source...`);
  const indexer = new Indexer();
  const result = await indexer.index(source, store, name);

  console.log(`\nIndexing complete!`);
  console.log(`  Type: ${result.type}`);
  console.log(`  Files indexed: ${result.filesIndexed}`);
  console.log(`  Files removed: ${result.filesRemoved}`);
  console.log(`  Duration: ${result.duration}ms`);
}

// Filesystem subcommand
const filesystemCommand = new Command("filesystem")
  .alias("fs")
  .description("Index local filesystem")
  .option("-p, --path <path>", "Path to index", ".");
addStoreOptions(filesystemCommand);
filesystemCommand.action(async (options) => {
  try {
    const source = new FilesystemSource({ rootPath: options.path });
    const store = await createStore(options);
    // Use "." as key if no --name, so files go directly in store-path
    const indexName = options.name || ".";
    await runIndex(source, store, indexName, "filesystem");
  } catch (error) {
    console.error("Indexing failed:", error);
    process.exit(1);
  }
});

// GitHub subcommand
const githubCommand = new Command("github")
  .description("Index a GitHub repository")
  .requiredOption("--owner <owner>", "Repository owner")
  .requiredOption("--repo <repo>", "Repository name")
  .option("--ref <ref>", "Branch, tag, or commit", "HEAD");
addStoreOptions(githubCommand);
githubCommand.action(async (options) => {
  try {
    const { GitHubSource } = await import("../sources/github.js");
    const source = new GitHubSource({
      owner: options.owner,
      repo: options.repo,
      ref: options.ref,
    });

    const store = await createStore(options);
    const indexName = options.name || ".";
    await runIndex(source, store, indexName, "github");
  } catch (error) {
    console.error("Indexing failed:", error);
    process.exit(1);
  }
});

// GitLab subcommand
const gitlabCommand = new Command("gitlab")
  .description("Index a GitLab project")
  .requiredOption("--project <id>", "Project ID or path (e.g., group/project)")
  .option("--ref <ref>", "Branch, tag, or commit", "HEAD")
  .option("--gitlab-url <url>", "GitLab base URL (for self-hosted)", "https://gitlab.com");
addStoreOptions(gitlabCommand);
gitlabCommand.action(async (options) => {
  try {
    const { GitLabSource } = await import("../sources/gitlab.js");
    const source = new GitLabSource({
      baseUrl: options.gitlabUrl,
      projectId: options.project,
      ref: options.ref,
    });
    const store = await createStore(options);
    const indexName = options.name || ".";
    await runIndex(source, store, indexName, "gitlab");
  } catch (error) {
    console.error("Indexing failed:", error);
    process.exit(1);
  }
});

// BitBucket subcommand
const bitbucketCommand = new Command("bitbucket")
  .description("Index a Bitbucket repository")
  .requiredOption("--workspace <slug>", "Workspace slug")
  .requiredOption("--repo <repo>", "Repository name")
  .option("--ref <ref>", "Branch, tag, or commit", "HEAD")
  .option("--bitbucket-url <url>", "Bitbucket base URL (for Server/Data Center)", "https://api.bitbucket.org/2.0");
addStoreOptions(bitbucketCommand);
bitbucketCommand.action(async (options) => {
  try {
    const { BitBucketSource } = await import("../sources/bitbucket.js");
    const source = new BitBucketSource({
      baseUrl: options.bitbucketUrl,
      workspace: options.workspace,
      repo: options.repo,
      ref: options.ref,
    });
    const store = await createStore(options);
    const indexName = options.name || ".";
    await runIndex(source, store, indexName, "bitbucket");
  } catch (error) {
    console.error("Indexing failed:", error);
    process.exit(1);
  }
});

// Website subcommand
const websiteCommand = new Command("website")
  .description("Crawl and index a website")
  .requiredOption("--url <url>", "Website URL to crawl")
  .option("--max-depth <n>", "Maximum crawl depth", (v) => parseInt(v, 10), 3)
  .option("--max-pages <n>", "Maximum pages to crawl", (v) => parseInt(v, 10), 100)
  .option("--include <patterns...>", "URL patterns to include (glob)")
  .option("--exclude <patterns...>", "URL patterns to exclude (glob)");
addStoreOptions(websiteCommand);
websiteCommand.action(async (options) => {
  try {
    const { WebsiteSource } = await import("../sources/website.js");
    const source = new WebsiteSource({
      url: options.url,
      maxDepth: options.maxDepth,
      maxPages: options.maxPages,
      includePaths: options.include,
      excludePaths: options.exclude,
    });
    const store = await createStore(options);
    const indexName = options.name || ".";
    await runIndex(source, store, indexName, "website");
  } catch (error) {
    console.error("Indexing failed:", error);
    process.exit(1);
  }
});

// Main index command
export const indexCommand = new Command("index")
  .description("Index a data source")
  .addCommand(filesystemCommand)
  .addCommand(githubCommand)
  .addCommand(gitlabCommand)
  .addCommand(bitbucketCommand)
  .addCommand(websiteCommand);

