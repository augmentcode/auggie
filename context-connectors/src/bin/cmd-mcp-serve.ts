/**
 * MCP Serve command - Start MCP HTTP server for remote access
 */

import { Command } from "commander";
import { FilesystemStore } from "../stores/filesystem.js";
import { runMCPHttpServer } from "../clients/mcp-http-server.js";

export const mcpServeCommand = new Command("mcp-serve")
  .description("Start MCP HTTP server for remote client access")
  .option("-n, --name <names...>", "Index name(s) to expose (default: all)")
  .option("--port <number>", "Port to listen on", "3000")
  .option("--host <host>", "Host to bind to", "localhost")
  .option("--cors <origins>", "CORS origins (comma-separated, or '*' for any)")
  .option("--base-path <path>", "Base path for MCP endpoint", "/mcp")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--store-path <path>", "Store base path")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--search-only", "Disable list_files/read_file tools (search only)")
  .option(
    "--api-key <key>",
    "API key for authentication (or set MCP_API_KEY env var)"
  )
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
      const server = await runMCPHttpServer({
        store,
        indexNames: options.name, // undefined means all
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

