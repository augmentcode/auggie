/**
 * Delete command - Delete an index from a store
 */

import { Command } from "commander";
import { FilesystemStore } from "../stores/filesystem.js";

export const deleteCommand = new Command("delete")
  .description("Delete an index from a store")
  .argument("<name>", "Index name to delete")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--store-path <path>", "Store base path")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--s3-prefix <prefix>", "S3 key prefix", "context-connectors/")
  .option("--s3-region <region>", "S3 region")
  .option("--s3-endpoint <url>", "S3-compatible endpoint URL (for MinIO, R2, etc.)")
  .option("--s3-force-path-style", "Use path-style S3 URLs (for some S3-compatible services)")
  .action(async (name, options) => {
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

      // Check if index exists
      const state = await store.load(name);
      if (!state) {
        console.error(`Index "${name}" not found.`);
        process.exit(1);
      }

      await store.delete(name);
      console.log(`Index "${name}" deleted successfully.`);
    } catch (error) {
      console.error("Delete failed:", error);
      process.exit(1);
    }
  });

