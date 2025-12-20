/**
 * Search command - Search indexed content
 */

import { Command } from "commander";
import { SearchClient } from "../clients/search-client.js";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";

export const searchCommand = new Command("search")
  .description("Search indexed content")
  .argument("<query>", "Search query")
  .requiredOption("-k, --key <name>", "Index key/name")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--store-path <path>", "Store base path", ".context-connectors")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--s3-prefix <prefix>", "S3 key prefix", "context-connectors/")
  .option("--s3-region <region>", "S3 region")
  .option("--s3-endpoint <url>", "S3-compatible endpoint URL (for MinIO, R2, etc.)")
  .option("--s3-force-path-style", "Use path-style S3 URLs (for some S3-compatible services)")
  .option("--max-chars <number>", "Max output characters", parseInt)
  .option("--with-source", "Enable listFiles/readFile (requires source config)")
  .option("-p, --path <path>", "Path for filesystem source (with --with-source)")
  .action(async (query, options) => {
    try {
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

      // Optionally create source
      let source;
      if (options.withSource) {
        // Load state to get source metadata
        const state = await store.load(options.key);
        if (!state) {
          console.error(`Index "${options.key}" not found`);
          process.exit(1);
        }

        if (state.source.type === "filesystem") {
          const path = options.path ?? state.source.identifier;
          source = new FilesystemSource({ rootPath: path });
        } else if (state.source.type === "github") {
          const [owner, repo] = state.source.identifier.split("/");
          const { GitHubSource } = await import("../sources/github.js");
          source = new GitHubSource({
            owner,
            repo,
            ref: state.source.ref,
          });
        } else if (state.source.type === "gitlab") {
          const { GitLabSource } = await import("../sources/gitlab.js");
          source = new GitLabSource({
            projectId: state.source.identifier,
            ref: state.source.ref,
          });
        } else if (state.source.type === "website") {
          const { WebsiteSource } = await import("../sources/website.js");
          // For website, the identifier is the hostname, but we need the full URL
          // Store the URL in the source metadata for re-creation
          source = new WebsiteSource({
            url: `https://${state.source.identifier}`,
          });
        }
      }

      // Create client
      const client = new SearchClient({
        store,
        source,
        key: options.key,
      });

      await client.initialize();

      const meta = client.getMetadata();
      console.log(`Searching index: ${options.key}`);
      console.log(`Source: ${meta.type}://${meta.identifier}`);
      console.log(`Last synced: ${meta.syncedAt}\n`);

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

