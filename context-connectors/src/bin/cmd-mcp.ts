/**
 * MCP command - Run MCP servers (local stdio or remote HTTP)
 */

import { Command } from "commander";
import { FilesystemStore } from "../stores/filesystem.js";
import { runMCPServer } from "../clients/mcp-server.js";
import { parseIndexSpecs } from "../stores/index-spec.js";
import { CompositeStoreReader } from "../stores/composite.js";

// Local subcommand (stdio-based MCP server)
const localCommand = new Command("local")
  .description("Start stdio-based MCP server")
  .option(
    "-i, --index <specs...>",
    "Index spec(s): name, path:/path, or s3://bucket/key"
  )
  .option("--store-path <path>", "Base path for named indexes (default: ~/.augment/context-connectors)")
  .option("--search-only", "Disable list_files/read_file tools (search only)")
  .action(async (options) => {
    try {
      const indexSpecs: string[] | undefined = options.index;

      let store;
      let indexNames: string[];

      if (indexSpecs && indexSpecs.length > 0) {
        // Parse index specs and create composite store
        const specs = parseIndexSpecs(indexSpecs);
        store = await CompositeStoreReader.fromSpecs(specs, options.storePath);
        indexNames = specs.map((s) => s.displayName);
      } else if (options.storePath) {
        // No --index but --store-path provided: load directly from store-path
        store = new FilesystemStore({ basePath: options.storePath });
        indexNames = ["."];
      } else {
        // No --index and no --store-path: use default store, list all indexes
        store = new FilesystemStore();
        indexNames = await store.list();
        if (indexNames.length === 0) {
          console.error("No indexes found. Create an index first with 'context-connectors index'");
          process.exit(1);
        }
      }

      // Start MCP server (writes to stdout, reads from stdin)
      await runMCPServer({
        store,
        indexNames,
        searchOnly: options.searchOnly,
      });
    } catch (error) {
      // Write errors to stderr (stdout is for MCP protocol)
      console.error("MCP server failed:", error);
      process.exit(1);
    }
  });

// Remote subcommand (HTTP-based MCP server)
const remoteCommand = new Command("remote")
  .description("Start HTTP-based MCP server for remote client access")
  .option(
    "-i, --index <specs...>",
    "Index spec(s): name, path:/path, or s3://bucket/key"
  )
  .option("--store-path <path>", "Base path for named indexes (default: ~/.augment/context-connectors)")
  .option("--port <number>", "Port to listen on", "3000")
  .option("--host <host>", "Host to bind to", "localhost")
  .option("--cors <origins>", "CORS origins (comma-separated, or '*' for any)")
  .option("--base-path <path>", "Base path for MCP endpoint", "/mcp")
  .option("--search-only", "Disable list_files/read_file tools (search only)")
  .option(
    "--api-key <key>",
    "API key for authentication (or set MCP_API_KEY env var)"
  )
  .action(async (options) => {
    try {
      const indexSpecs: string[] | undefined = options.index;

      let store;
      let indexNames: string[] | undefined;

      if (indexSpecs && indexSpecs.length > 0) {
        // Parse index specs and create composite store
        const specs = parseIndexSpecs(indexSpecs);
        store = await CompositeStoreReader.fromSpecs(specs, options.storePath);
        indexNames = specs.map((s) => s.displayName);
      } else if (options.storePath) {
        // No --index but --store-path provided: use that store, serve all
        store = new FilesystemStore({ basePath: options.storePath });
        indexNames = undefined; // undefined means all
      } else {
        // No --index and no --store-path: use default store, serve all
        store = new FilesystemStore();
        indexNames = undefined;
      }

      // Parse CORS option
      let cors: string | string[] | undefined;
      if (options.cors) {
        cors =
          options.cors === "*"
            ? "*"
            : options.cors.split(",").map((s: string) => s.trim());
      }

      // Get API key from option or environment
      const apiKey = options.apiKey ?? process.env.MCP_API_KEY;

      // Start HTTP server
      const { runMCPHttpServer } = await import("../clients/mcp-http-server.js");
      const server = await runMCPHttpServer({
        store,
        indexNames,
        searchOnly: options.searchOnly,
        port: parseInt(options.port, 10),
        host: options.host,
        cors,
        basePath: options.basePath,
        apiKey,
      });

      console.log(`MCP HTTP server listening at ${server.getUrl()}`);
      console.log(`Connect with MCP clients using Streamable HTTP transport`);
      if (apiKey) {
        console.log(`Authentication: API key required (Authorization: Bearer <key>)`);
      } else {
        console.log(`Authentication: None (open access)`);
      }

      // Handle shutdown
      const shutdown = async () => {
        console.log("\nShutting down...");
        await server.stop();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } catch (error) {
      console.error("Failed to start MCP HTTP server:", error);
      process.exit(1);
    }
  });

// Main mcp command
export const mcpCommand = new Command("mcp")
  .description("Run MCP servers")
  .addCommand(localCommand)
  .addCommand(remoteCommand);

