/**
 * Search command - Search indexed content
 */

import { Command } from "commander";
import { SearchClient } from "../clients/search-client.js";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";
import { getSourceIdentifier } from "../core/types.js";
import type { Source } from "../sources/types.js";

export const searchCommand = new Command("search")
  .description("Search indexed content")
  .argument("<query>", "Search query")
  .option("-i, --index <name>", "Index name (loads from {store-path}/{name}/search.json)")
  .option("-n, --name <name>", "Alias for --index")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--store-path <path>", "Store base path (loads directly from {store-path}/search.json if no --index)")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--s3-prefix <prefix>", "S3 key prefix", "context-connectors/")
  .option("--s3-region <region>", "S3 region")
  .option("--s3-endpoint <url>", "S3-compatible endpoint URL (for MinIO, R2, etc.)")
  .option("--s3-force-path-style", "Use path-style S3 URLs (for some S3-compatible services)")
  .option("--max-chars <number>", "Max output characters", parseInt)
  .option("--search-only", "Disable file access (search only)")
  .option("-p, --path <path>", "Path override for filesystem source")
  .action(async (query, options) => {
    try {
      // --index and --name are aliases, prefer --index
      const indexName = options.index || options.name;
      // Use "." as key if no --index, so files are loaded directly from store-path
      const indexKey = indexName || ".";

      // Create store
      let store;
      if (options.store === "filesystem") {
        store = new FilesystemStore({ basePath: options.storePath });
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

      // Load state to get source metadata
      const state = await store.loadSearch(indexKey);
      if (!state) {
        const location = indexName
          ? `index "${indexName}"`
          : `store path "${options.storePath}"`;
        console.error(`Index not found at ${location}`);
        process.exit(1);
      }

      // Create source unless --search-only is specified
      let source: Source | undefined;
      if (!options.searchOnly) {
        const meta = state.source;
        if (meta.type === "filesystem") {
          // Allow override via --path option
          const config = options.path
            ? { ...meta.config, rootPath: options.path }
            : meta.config;
          source = new FilesystemSource(config);
        } else if (meta.type === "github") {
          const { GitHubSource } = await import("../sources/github.js");
          source = new GitHubSource(meta.config);
        } else if (meta.type === "gitlab") {
          const { GitLabSource } = await import("../sources/gitlab.js");
          source = new GitLabSource(meta.config);
        } else if (meta.type === "bitbucket") {
          const { BitBucketSource } = await import("../sources/bitbucket.js");
          source = new BitBucketSource(meta.config);
        } else if (meta.type === "website") {
          const { WebsiteSource } = await import("../sources/website.js");
          source = new WebsiteSource(meta.config);
        }
      }

      // Create client
      const client = new SearchClient({
        store,
        source,
        indexName: indexKey,
      });

      await client.initialize();

      const clientMeta = client.getMetadata();
      const displayName = indexName || getSourceIdentifier(clientMeta);
      console.log(`Searching index: ${displayName}`);
      console.log(`Source: ${clientMeta.type}://${getSourceIdentifier(clientMeta)}`);
      console.log(`Last synced: ${clientMeta.syncedAt}\n`);

      const result = await client.search(query, {
        maxOutputLength: options.maxChars,
      });

      if (!result.results || result.results.trim().length === 0) {
        console.log("No results found.");
        return;
      }

      console.log("Results:\n");
      console.log(result.results);
    } catch (error) {
      console.error("Search failed:", error);
      process.exit(1);
    }
  });

