/**
 * MCP Server - Exposes context-connector tools to AI assistants.
 *
 * Implements the Model Context Protocol (MCP) to enable integration with:
 * - Claude Desktop
 * - Other MCP-compatible AI assistants
 *
 * The server exposes these tools:
 * - `search`: Always available
 * - `list_files`: Available when Source is configured
 * - `read_file`: Available when Source is configured
 *
 * @module clients/mcp-server
 * @see https://modelcontextprotocol.io/
 *
 * @example
 * ```typescript
 * import { runMCPServer } from "@augmentcode/context-connectors";
 * import { FilesystemStore } from "@augmentcode/context-connectors/stores";
 *
 * await runMCPServer({
 *   store: new FilesystemStore(),
 *   key: "my-project",
 * });
 * ```
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { IndexStoreReader } from "../stores/types.js";
import type { Source } from "../sources/types.js";
import { SearchClient } from "./search-client.js";

/**
 * Configuration for the MCP server.
 */
export interface MCPServerConfig {
  /** Store to load index from */
  store: IndexStoreReader;
  /**
   * Optional source for file operations.
   * When provided, enables list_files and read_file tools.
   */
  source?: Source;
  /** Index key/name to serve */
  key: string;
  /**
   * Server name reported to MCP clients.
   * @default "context-connectors"
   */
  name?: string;
  /**
   * Server version reported to MCP clients.
   * @default "0.1.0"
   */
  version?: string;
}

/**
 * Create an MCP server instance.
 *
 * Creates but does not start the server. Use `runMCPServer()` for
 * the common case of running with stdio transport.
 *
 * @param config - Server configuration
 * @returns Configured MCP Server instance
 *
 * @example
 * ```typescript
 * const server = await createMCPServer({
 *   store: new FilesystemStore(),
 *   key: "my-project",
 * });
 *
 * // Connect with custom transport
 * await server.connect(myTransport);
 * ```
 */
export async function createMCPServer(
  config: MCPServerConfig
): Promise<Server> {
  // Initialize SearchClient
  const client = new SearchClient({
    store: config.store,
    source: config.source,
    key: config.key,
  });
  await client.initialize();

  const meta = client.getMetadata();
  const hasSource = !!config.source;

  // Create MCP server
  const server = new Server(
    {
      name: config.name ?? "context-connectors",
      version: config.version ?? "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Define tool type for type safety
  type Tool = {
    name: string;
    description: string;
    inputSchema: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: "search",
        description: `Search the indexed codebase (${meta.type}://${meta.identifier}). Returns relevant code snippets.`,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language search query",
            },
            maxChars: {
              type: "number",
              description: "Maximum characters in response (optional)",
            },
          },
          required: ["query"],
        },
      },
    ];

    // Only advertise file tools if source is configured
    if (hasSource) {
      tools.push(
        {
          name: "list_files",
          description: "List files and directories in a specific directory (non-recursive). Use multiple calls to explore subdirectories.",
          inputSchema: {
            type: "object",
            properties: {
              directory: {
                type: "string",
                description:
                  "Directory to list (default: root). Only immediate children are returned.",
              },
              pattern: {
                type: "string",
                description:
                  "Optional glob pattern to filter results (e.g., '*.ts')",
              },
            },
            required: [],
          },
        },
        {
          name: "read_file",
          description: "Read the contents of a specific file",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Path to the file to read",
              },
            },
            required: ["path"],
          },
        }
      );
    }

    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "search": {
          const result = await client.search(args?.query as string, {
            maxOutputLength: args?.maxChars as number | undefined,
          });
          return {
            content: [
              { type: "text", text: result.results || "No results found." },
            ],
          };
        }

        case "list_files": {
          const entries = await client.listFiles({
            directory: args?.directory as string | undefined,
            pattern: args?.pattern as string | undefined,
          });
          const text = entries.map((e) => `${e.path} [${e.type}]`).join("\n");
          return {
            content: [{ type: "text", text: text || "No files found." }],
          };
        }

        case "read_file": {
          const result = await client.readFile(args?.path as string);
          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }],
              isError: true,
            };
          }
          return {
            content: [{ type: "text", text: result.contents ?? "" }],
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Run an MCP server with stdio transport.
 *
 * This is the main entry point for running the MCP server.
 * It creates the server and connects it to stdin/stdout for
 * communication with the MCP client (e.g., Claude Desktop).
 *
 * This function does not return until the server is stopped.
 *
 * @param config - Server configuration
 *
 * @example
 * ```typescript
 * // Typically called from CLI
 * await runMCPServer({
 *   store: new FilesystemStore(),
 *   source: new FilesystemSource({ rootPath: "./project" }),
 *   key: "my-project",
 * });
 * ```
 */
export async function runMCPServer(config: MCPServerConfig): Promise<void> {
  const server = await createMCPServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

