/**
 * Search command - Search indexed content
 */

import { Command } from "commander";
import { SearchClient } from "../clients/search-client.js";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";
import { getSourceIdentifier } from "../core/types.js";
import { getS3Config } from "../stores/s3-config.js";
import { parseIndexSpec } from "../stores/index-spec.js";
import type { Source } from "../sources/types.js";
import type { IndexStoreReader } from "../stores/types.js";

export const searchCommand = new Command("search")
  .description("Search indexed content")
  .argument("<query>", "Search query")
  .requiredOption(
    "-i, --index <spec>",
    "Index spec: name, path:/path, or s3://bucket/key"
  )
  .option("--store-path <path>", "Base path for named indexes (default: ~/.augment/context-connectors)")
  .option("--max-chars <number>", "Max output characters", parseInt)
  .option("--search-only", "Disable file access (search only)")
  .action(async (query, options) => {
    try {
      // Parse index spec and create store
      const spec = parseIndexSpec(options.index);
      let store: IndexStoreReader;
      let indexKey: string;
      let displayName: string;

      switch (spec.type) {
        case "name":
          store = new FilesystemStore({ basePath: options.storePath });
          indexKey = spec.value;
          displayName = spec.value;
          break;

        case "path":
          store = new FilesystemStore({ basePath: spec.value });
          indexKey = ".";
          displayName = spec.value;
          break;

        case "s3": {
          const url = spec.value;
          const pathPart = url.slice(5); // Remove "s3://"
          const slashIdx = pathPart.indexOf("/");
          const bucket = pathPart.slice(0, slashIdx);
          const keyPath = pathPart.slice(slashIdx + 1);

          const baseConfig = getS3Config();
          const { S3Store } = await import("../stores/s3.js");

          const lastSlash = keyPath.lastIndexOf("/");
          if (lastSlash === -1) {
            store = new S3Store({ ...baseConfig, bucket, prefix: "" });
            indexKey = keyPath;
          } else {
            const prefix = keyPath.slice(0, lastSlash + 1);
            indexKey = keyPath.slice(lastSlash + 1);
            store = new S3Store({ ...baseConfig, bucket, prefix });
          }
          displayName = url;
          break;
        }
      }

      // Load state to get source metadata
      const state = await store.loadSearch(indexKey);
      if (!state) {
        console.error(`Index not found: ${options.index}`);
        process.exit(1);
      }

      // Create source unless --search-only is specified
      let source: Source | undefined;
      if (!options.searchOnly) {
        const meta = state.source;
        if (meta.type === "filesystem") {
          source = new FilesystemSource(meta.config);
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

