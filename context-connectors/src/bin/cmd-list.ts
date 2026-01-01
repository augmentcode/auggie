/**
 * List command - List all indexed keys in a store
 */

import { Command } from "commander";
import { FilesystemStore } from "../stores/filesystem.js";
import type { IndexStore } from "../stores/types.js";

/** Format a relative time string (e.g., "2h ago", "5d ago") */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "just now";
}

export const listCommand = new Command("list")
  .description("List all indexes in a store")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--store-path <path>", "Store base path")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--s3-prefix <prefix>", "S3 key prefix", "context-connectors/")
  .option("--s3-region <region>", "S3 region")
  .option("--s3-endpoint <url>", "S3-compatible endpoint URL (for MinIO, R2, etc.)")
  .option("--s3-force-path-style", "Use path-style S3 URLs (for some S3-compatible services)")
  .action(async (options) => {
    try {
      // Create store
      let store: IndexStore;
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

      const keys = await store.list();

      if (keys.length === 0) {
        console.log("No indexes found.");
        return;
      }

      // Load metadata for each index
      const indexes: Array<{
        name: string;
        type: string;
        identifier: string;
        syncedAt: string;
      }> = [];

      for (const key of keys) {
        const state = await store.load(key);
        if (state) {
          indexes.push({
            name: key,
            type: state.source.type,
            identifier: state.source.identifier,
            syncedAt: state.source.syncedAt,
          });
        }
      }

      // Calculate column widths
      const nameWidth = Math.max(4, ...indexes.map((i) => i.name.length));
      const sourceWidth = Math.max(
        6,
        ...indexes.map((i) => `${i.type}://${i.identifier}`.length)
      );

      // Print header
      console.log(
        `${"NAME".padEnd(nameWidth)}  ${"SOURCE".padEnd(sourceWidth)}  SYNCED`
      );

      // Print indexes
      for (const idx of indexes) {
        const source = `${idx.type}://${idx.identifier}`;
        const synced = formatRelativeTime(idx.syncedAt);
        console.log(
          `${idx.name.padEnd(nameWidth)}  ${source.padEnd(sourceWidth)}  ${synced}`
        );
      }

      console.log(`\nTotal: ${indexes.length} index(es)`);
    } catch (error) {
      console.error("List failed:", error);
      process.exit(1);
    }
  });

