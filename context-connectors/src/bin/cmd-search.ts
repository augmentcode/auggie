/**
 * Search command - Search indexed content
 */

import { Command } from "commander";
import { SearchClient } from "../clients/search-client.js";
import { FilesystemStore } from "../stores/filesystem.js";
import { getSourceIdentifier } from "../core/types.js";
import { getS3Config } from "../stores/s3-config.js";
import { parseIndexSpec } from "../stores/index-spec.js";
import type { IndexStoreReader } from "../stores/types.js";

export const searchCommand = new Command("search")
  .description("Search indexed content and answer questions (use --raw for raw results)")
  .argument("<query>", "Search query (also used as the question unless --raw)")
  .requiredOption(
    "-i, --index <spec>",
    "Index spec: name, path:/path, or s3://bucket/key"
  )
  .option("--max-chars <number>", "Max output characters (only for --raw)", parseInt)
  .option("--raw", "Return raw search results instead of asking LLM")
  .action(async (query, options) => {
    try {
      // Parse index spec and create store
      const spec = parseIndexSpec(options.index);
      let store: IndexStoreReader;
      let indexKey: string;
      let displayName: string;

      switch (spec.type) {
        case "name":
          // Use default store path (~/.augment/context-connectors)
          store = new FilesystemStore();
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

          if (slashIdx === -1) {
            throw new Error(
              "Invalid S3 URL: missing index key. Expected format: s3://bucket/path/to/index"
            );
          }

          const bucket = pathPart.slice(0, slashIdx);
          // Trim trailing slashes to avoid empty indexKey
          const keyPath = pathPart.slice(slashIdx + 1).replace(/\/+$/, "");

          if (!keyPath) {
            throw new Error(
              "Invalid S3 URL: missing index key. Expected format: s3://bucket/path/to/index"
            );
          }

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

      // Create client (search-only, no source needed)
      const client = new SearchClient({
        store,
        indexName: indexKey,
      });

      await client.initialize();

      const clientMeta = client.getMetadata();
      console.log(`Searching index: ${displayName}`);
      console.log(`Source: ${clientMeta.type}://${getSourceIdentifier(clientMeta)}`);
      console.log(`Last synced: ${clientMeta.syncedAt}\n`);

      if (options.raw) {
        // Raw mode: just return search results
        const result = await client.search(query, {
          maxOutputLength: options.maxChars,
        });

        if (!result.results || result.results.trim().length === 0) {
          console.log("No results found.");
          return;
        }

        console.log("Results:\n");
        console.log(result.results);
      } else {
        // Default: searchAndAsk - use LLM to answer based on search results
        const answer = await client.searchAndAsk(query, query);

        if (!answer || answer.trim().length === 0) {
          console.log("No answer found.");
          return;
        }

        console.log("Answer:\n");
        console.log(answer);
      }
    } catch (error) {
      console.error("Search failed:", error);
      process.exit(1);
    }
  });

