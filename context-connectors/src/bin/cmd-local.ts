/**
 * Local command - Manage local indexes
 */

import { Command } from "commander";
import { FilesystemStore } from "../stores/filesystem.js";
import { getSourceIdentifier } from "../core/types.js";

// List subcommand
const listCommand = new Command("list")
  .description("List local indexes")
  .option("--store-path <path>", "Store base path (default: ~/.augment/context-connectors)")
  .action(async (options) => {
    try {
      const store = new FilesystemStore({ basePath: options.storePath });
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
        const state = await store.loadSearch(key);
        if (state) {
          indexes.push({
            name: key,
            type: state.source.type,
            identifier: getSourceIdentifier(state.source),
            syncedAt: state.source.syncedAt,
          });
        }
      }

      // Format relative time
      const formatRelativeTime = (isoDate: string): string => {
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
      };

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

// Delete subcommand
const deleteCommand = new Command("delete")
  .description("Delete a local index")
  .argument("<name>", "Index name to delete")
  .option("--store-path <path>", "Store base path (default: ~/.augment/context-connectors)")
  .action(async (name, options) => {
    try {
      const store = new FilesystemStore({ basePath: options.storePath });

      // Check if index exists
      const state = await store.loadSearch(name);
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

// Main local command
export const localCommand = new Command("local")
  .description("Manage local indexes")
  .addCommand(listCommand)
  .addCommand(deleteCommand);

