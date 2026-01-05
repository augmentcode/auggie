/**
 * MCP command - Run MCP servers (local stdio or remote HTTP)
 */

import { Command } from "commander";
import { FilesystemStore } from "../stores/filesystem.js";
import { runMCPServer } from "../clients/mcp-server.js";
import { getS3Config } from "../stores/s3-config.js";

// Helper to create store
async function createStore(options: {
  store: string;
  storePath?: string;
}) {
  if (options.store === "filesystem") {
    return new FilesystemStore({ basePath: options.storePath });
  } else if (options.store === "s3") {
    const s3Config = getS3Config();
    if (!s3Config.bucket) {
      console.error("S3 store requires CC_S3_BUCKET environment variable");
      process.exit(1);
    }
    const { S3Store } = await import("../stores/s3.js");
    return new S3Store(s3Config);
  } else {
    console.error(`Unknown store type: ${options.store}`);
    process.exit(1);
  }
}

// Local subcommand (stdio-based MCP server)
const localCommand = new Command("local")
  .description("Start stdio-based MCP server")
  .option("-i, --index <names...>", "Index name(s) to expose (loads from {store-path}/{name}/)")
  .option("-n, --name <names...>", "Alias for --index")
  .option("--store <type>", "Store type: filesystem, s3 (S3 requires CC_S3_* env vars)", "filesystem")
  .option("--store-path <path>", "Store base path (loads directly from {store-path}/search.json if no --index)")
  .option("--search-only", "Disable list_files/read_file tools (search only)")
  .action(async (options) => {
    try {
      // --index and --name are aliases, prefer --index
      const indexNames: string[] | undefined = options.index || options.name;
      // Use "." as key if no --index, so files are loaded directly from store-path
      const indexKeys = indexNames || ["."];

      const store = await createStore(options);

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

// Remote subcommand (HTTP-based MCP server)
const remoteCommand = new Command("remote")
  .description("Start HTTP-based MCP server for remote client access")
  .option("-i, --index <names...>", "Index name(s) to expose (default: all)")
  .option("-n, --name <names...>", "Alias for --index")
  .option("--port <number>", "Port to listen on", "3000")
  .option("--host <host>", "Host to bind to", "localhost")
  .option("--cors <origins>", "CORS origins (comma-separated, or '*' for any)")
  .option("--base-path <path>", "Base path for MCP endpoint", "/mcp")
  .option("--store <type>", "Store type: filesystem, s3 (S3 requires CC_S3_* env vars)", "filesystem")
  .option("--store-path <path>", "Store base path")
  .option("--search-only", "Disable list_files/read_file tools (search only)")
  .option(
    "--api-key <key>",
    "API key for authentication (or set MCP_API_KEY env var)"
  )
  .action(async (options) => {
    try {
      const store = await createStore(options);

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

      // --index and --name are aliases, prefer --index
      const indexNames: string[] | undefined = options.index || options.name;

      // Start HTTP server
      const { runMCPHttpServer } = await import("../clients/mcp-http-server.js");
      const server = await runMCPHttpServer({
        store,
        indexNames, // undefined means all
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

