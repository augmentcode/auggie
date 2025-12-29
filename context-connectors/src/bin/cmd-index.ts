/**
 * Index command - Index a data source
 */

import { Command } from "commander";
import { Indexer } from "../core/indexer.js";
import { FilesystemSource } from "../sources/filesystem.js";
import { FilesystemStore } from "../stores/filesystem.js";

export const indexCommand = new Command("index")
  .description("Index a data source")
  .requiredOption("-s, --source <type>", "Source type (filesystem, github, gitlab, bitbucket, website)")
  .requiredOption("-n, --name <name>", "Index name")
  .option("-p, --path <path>", "Path for filesystem source", ".")
  .option("--owner <owner>", "GitHub repository owner")
  .option("--repo <repo>", "GitHub/BitBucket repository name")
  .option("--ref <ref>", "GitHub/GitLab/BitBucket ref (branch/tag/commit)", "HEAD")
  // GitLab options
  .option("--gitlab-url <url>", "GitLab base URL (for self-hosted)", "https://gitlab.com")
  .option("--project <id>", "GitLab project ID or path (e.g., group/project)")
  // BitBucket options
  .option("--workspace <slug>", "BitBucket workspace slug")
  .option("--bitbucket-url <url>", "BitBucket base URL (for Server/Data Center)", "https://api.bitbucket.org/2.0")
  // Website options
  .option("--url <url>", "Website URL to crawl")
  .option("--max-depth <n>", "Maximum crawl depth (website)", (v) => parseInt(v, 10), 3)
  .option("--max-pages <n>", "Maximum pages to crawl (website)", (v) => parseInt(v, 10), 100)
  .option("--include <patterns...>", "URL path patterns to include (website, glob)")
  .option("--exclude <patterns...>", "URL path patterns to exclude (website, glob)")
  // Store options
  .option("--store <type>", "Store type (filesystem, memory, s3)", "filesystem")
  .option("--store-path <path>", "Store base path (for filesystem store)")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--s3-prefix <prefix>", "S3 key prefix", "context-connectors/")
  .option("--s3-region <region>", "S3 region")
  .option("--s3-endpoint <url>", "S3-compatible endpoint URL (for MinIO, R2, etc.)")
  .option("--s3-force-path-style", "Use path-style S3 URLs (for some S3-compatible services)")
  .action(async (options) => {
    try {
      // Create source
      let source;
      if (options.source === "filesystem") {
        source = new FilesystemSource({ rootPath: options.path });
      } else if (options.source === "github") {
        if (!options.owner || !options.repo) {
          console.error("GitHub source requires --owner and --repo options");
          process.exit(1);
        }
        const { GitHubSource } = await import("../sources/github.js");
        source = new GitHubSource({
          owner: options.owner,
          repo: options.repo,
          ref: options.ref,
        });
      } else if (options.source === "gitlab") {
        if (!options.project) {
          console.error("GitLab source requires --project option");
          process.exit(1);
        }
        const { GitLabSource } = await import("../sources/gitlab.js");
        source = new GitLabSource({
          baseUrl: options.gitlabUrl,
          projectId: options.project,
          ref: options.ref,
        });
      } else if (options.source === "bitbucket") {
        if (!options.workspace || !options.repo) {
          console.error("BitBucket source requires --workspace and --repo options");
          process.exit(1);
        }
        const { BitBucketSource } = await import("../sources/bitbucket.js");
        source = new BitBucketSource({
          baseUrl: options.bitbucketUrl,
          workspace: options.workspace,
          repo: options.repo,
          ref: options.ref,
        });
      } else if (options.source === "website") {
        if (!options.url) {
          console.error("Website source requires --url option");
          process.exit(1);
        }
        const { WebsiteSource } = await import("../sources/website.js");
        source = new WebsiteSource({
          url: options.url,
          maxDepth: options.maxDepth,
          maxPages: options.maxPages,
          includePaths: options.include,
          excludePaths: options.exclude,
        });
      } else {
        console.error(`Unknown source type: ${options.source}`);
        process.exit(1);
      }

      // Create store
      let store;
      if (options.store === "filesystem") {
        store = new FilesystemStore({ basePath: options.storePath });
      } else if (options.store === "memory") {
        const { MemoryStore } = await import("../stores/memory.js");
        store = new MemoryStore();
        console.warn("Warning: Using MemoryStore - data will be lost when process exits");
      } else if (options.store === "s3") {
        if (!options.bucket) {
          console.error("S3 store requires --bucket option");
          process.exit(1);
        }
        const { S3Store } = await import("../stores/s3.js");
        store = new S3Store({
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

      // Run indexer
      console.log(`Indexing ${options.source} source...`);
      const indexer = new Indexer();
      const result = await indexer.index(source, store, options.name);

      console.log(`\nIndexing complete!`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Files indexed: ${result.filesIndexed}`);
      console.log(`  Files removed: ${result.filesRemoved}`);
      console.log(`  Duration: ${result.duration}ms`);
    } catch (error) {
      console.error("Indexing failed:", error);
      process.exit(1);
    }
  });

