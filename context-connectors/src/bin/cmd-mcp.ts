/**
 * MCP command - Start MCP server for Claude Desktop integration
 */

import { Command } from "commander";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";
import { runMCPServer } from "../clients/mcp-server.js";

export const mcpCommand = new Command("mcp")
  .description("Start MCP server for Claude Desktop integration")
  .requiredOption("-k, --key <name>", "Index key/name")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--store-path <path>", "Store base path", ".context-connectors")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--with-source", "Enable list_files/read_file tools")
  .option("-p, --path <path>", "Path for filesystem source")
  .action(async (options) => {
    try {
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

      // Load state to determine source type
      const state = await store.load(options.key);
      if (!state) {
        console.error(`Index "${options.key}" not found`);
        process.exit(1);
      }

      // Optionally create source
      let source;
      if (options.withSource) {
        if (state.source.type === "filesystem") {
          const path = options.path ?? state.source.identifier;
          source = new FilesystemSource({ rootPath: path });
        } else if (state.source.type === "github") {
          const [owner, repo] = state.source.identifier.split("/");
          const { GitHubSource } = await import("../sources/github.js");
          source = new GitHubSource({ owner, repo, ref: state.source.ref });
        }
      }

      // Start MCP server (writes to stdout, reads from stdin)
      await runMCPServer({
        store,
        source,
        key: options.key,
      });
    } catch (error) {
      // Write errors to stderr (stdout is for MCP protocol)
      console.error("MCP server failed:", error);
      process.exit(1);
    }
  });

