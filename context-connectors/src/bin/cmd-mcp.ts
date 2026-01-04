/**
 * MCP command - Run as MCP server
 */

import { Command } from "commander";
import { FilesystemStore } from "../stores/filesystem.js";
import { runMCPServer } from "../clients/mcp-server.js";

export const mcpCommand = new Command("mcp")
  .description("Run as MCP server")
  .option("-i, --index <names...>", "Index name(s) to expose (loads from {store-path}/{name}/)")
  .option("-n, --name <names...>", "Alias for --index")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--store-path <path>", "Store base path (loads directly from {store-path}/search.json if no --index)")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--search-only", "Disable list_files/read_file tools (search only)")
  .action(async (options) => {
    try {
      // --index and --name are aliases, prefer --index
      const indexNames: string[] | undefined = options.index || options.name;
      // Use "." as key if no --index, so files are loaded directly from store-path
      const indexKeys = indexNames || ["."];

      // Create store
      let store;
      if (options.store === "filesystem") {
        store = new FilesystemStore({ basePath: options.storePath });
      } else if (options.store === "s3") {
        const { S3Store } = await import("../stores/s3.js");
        store = new S3Store({ bucket: options.bucket });
      } else {
        console.error(`Unknown store type: ${options.store}`);
        process.exit(1);
      }

      // Start MCP server (writes to stdout, reads from stdin)
      await runMCPServer({
        store,
        indexNames: indexKeys,
        searchOnly: options.searchOnly,
      });
    } catch (error) {
      // Write errors to stderr (stdout is for MCP protocol)
      console.error("MCP server failed:", error);
      process.exit(1);
    }
  });

