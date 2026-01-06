/**
 * MCP Server - Exposes context-connector tools to AI assistants.
 *
 * Implements the Model Context Protocol (MCP) to enable integration with:
 * - Claude Desktop
 * - Other MCP-compatible AI assistants
 *
 * The server exposes these tools:
 * - `search`: Search across one or more indexes
 * - `list_files`: List files in an index (when source available)
 * - `read_file`: Read file contents (when source available)
 *
 * @module clients/mcp-server
 * @see https://modelcontextprotocol.io/
 *
 * @example
 * ```typescript
 * import { runMCPServer } from "@augmentcode/context-connectors";
 * import { FilesystemStore } from "@augmentcode/context-connectors/stores";
 *
 * // Serve all indexes in the store
 * await runMCPServer({
 *   store: new FilesystemStore(),
 * });
 *
 * // Serve specific indexes only
 * await runMCPServer({
 *   store: new FilesystemStore(),
 *   indexNames: ["react", "docs"],
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
import { MultiIndexRunner } from "./multi-index-runner.js";
import {
  SEARCH_DESCRIPTION,
  LIST_FILES_DESCRIPTION,
  READ_FILE_DESCRIPTION,
  withIndexList,
} from "./tool-descriptions.js";

/**
 * Configuration for the MCP server.
 */
export interface MCPServerConfig {
  /** Store to load indexes from */
  store: IndexStoreReader;
  /**
   * Index names to expose. If undefined, all indexes in the store are exposed.
   */
  indexNames?: string[];
  /**
   * Disable file operations (list_files, read_file).
   * When true, only search is available.
   */
  searchOnly?: boolean;
  /**
   * Server name reported to MCP clients.
   * @default "context-connectors"
   */
  serverName?: string;
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
 * });
 *
 * // Connect with custom transport
 * await server.connect(myTransport);
 * ```
 */
export async function createMCPServer(
  config: MCPServerConfig
): Promise<Server> {
  // Create shared runner for multi-index operations
  const runner = await MultiIndexRunner.create({
    store: config.store,
    indexNames: config.indexNames,
    searchOnly: config.searchOnly,
  });

  const { indexNames, indexes } = runner;
  const searchOnly = !runner.hasFileOperations();

  // Format index list for tool descriptions
  const indexListStr = runner.getIndexListString();

  // Create MCP server
  const server = new Server(
    {
      name: config.serverName ?? "context-connectors",
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
      properties: Record<
        string,
        { type: string; description: string; enum?: string[] }
      >;
      required?: string[];
    };
  };

  // Tool descriptions with available indexes (from shared module)
  const searchDescription = withIndexList(SEARCH_DESCRIPTION, indexListStr);
  const listFilesDescription = withIndexList(LIST_FILES_DESCRIPTION, indexListStr);
  const readFileDescription = withIndexList(READ_FILE_DESCRIPTION, indexListStr);

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: "search",
        description: searchDescription,
        inputSchema: {
          type: "object",
          properties: {
            index_name: {
              type: "string",
              description: "Name of the index to search.",
              enum: indexNames,
            },
            query: {
              type: "string",
              description: "Natural language description of what you're looking for.",
            },
            maxChars: {
              type: "number",
              description: "Maximum characters in response (optional).",
            },
          },
          required: ["index_name", "query"],
        },
      },
    ];

    // Only advertise file tools if not in search-only mode
    if (!searchOnly) {
      tools.push(
        {
          name: "list_files",
          description: listFilesDescription,
          inputSchema: {
            type: "object",
            properties: {
              index_name: {
                type: "string",
                description: "Name of the index.",
                enum: indexNames,
              },
              directory: {
                type: "string",
                description: "Directory to list (default: root).",
              },
              pattern: {
                type: "string",
                description: "Glob pattern to filter results (e.g., '*.ts', 'src/*.json').",
              },
              depth: {
                type: "number",
                description: "Maximum depth to recurse (default: 2). Use 1 for immediate children only.",
              },
              showHidden: {
                type: "boolean",
                description: "Include hidden files starting with '.' (default: false).",
              },
            },
            required: ["index_name"],
          },
        },
        {
          name: "read_file",
          description: readFileDescription,
          inputSchema: {
            type: "object",
            properties: {
              index_name: {
                type: "string",
                description: "Name of the index.",
                enum: indexNames,
              },
              path: {
                type: "string",
                description: "Path to the file to read, relative to the source root.",
              },
              startLine: {
                type: "number",
                description: "First line to read (1-based, inclusive). Default: 1.",
              },
              endLine: {
                type: "number",
                description: "Last line to read (1-based, inclusive). Use -1 for end of file. Default: -1.",
              },
              searchPattern: {
                type: "string",
                description: "Regex pattern to search for. Only matching lines and context will be shown.",
              },
              contextLinesBefore: {
                type: "number",
                description: "Lines of context before each regex match (default: 5).",
              },
              contextLinesAfter: {
                type: "number",
                description: "Lines of context after each regex match (default: 5).",
              },
              includeLineNumbers: {
                type: "boolean",
                description: "Include line numbers in output (default: true).",
              },
            },
            required: ["index_name", "path"],
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
      const indexName = args?.index_name as string;
      const client = await runner.getClient(indexName);

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
          if (searchOnly) {
            return {
              content: [{ type: "text", text: "File operations disabled (search-only mode)" }],
              isError: true,
            };
          }
          const listOpts = {
            directory: args?.directory as string | undefined,
            pattern: args?.pattern as string | undefined,
            depth: args?.depth as number | undefined,
            showHidden: args?.showHidden as boolean | undefined,
          };
          const entries = await client.listFiles(listOpts);
          const { formatListOutput } = await import("../tools/list-files.js");
          const text = formatListOutput(entries, listOpts);
          return {
            content: [{ type: "text", text }],
          };
        }

        case "read_file": {
          if (searchOnly) {
            return {
              content: [{ type: "text", text: "File operations disabled (search-only mode)" }],
              isError: true,
            };
          }
          const result = await client.readFile(args?.path as string, {
            startLine: args?.startLine as number | undefined,
            endLine: args?.endLine as number | undefined,
            searchPattern: args?.searchPattern as string | undefined,
            contextLinesBefore: args?.contextLinesBefore as number | undefined,
            contextLinesAfter: args?.contextLinesAfter as number | undefined,
            includeLineNumbers: args?.includeLineNumbers as boolean | undefined,
          });
          if (result.error) {
            let errorText = `Error: ${result.error}`;
            if (result.suggestions && result.suggestions.length > 0) {
              errorText += `\n\nDid you mean one of these?\n${result.suggestions.map((s) => `  - ${s}`).join("\n")}`;
            }
            return {
              content: [{ type: "text", text: errorText }],
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
 * communication with the MCP client.
 *
 * This function does not return until the server is stopped.
 *
 * @param config - Server configuration
 *
 * @example
 * ```typescript
 * // Serve all indexes in the store
 * await runMCPServer({
 *   store: new FilesystemStore(),
 * });
 *
 * // Serve specific indexes only
 * await runMCPServer({
 *   store: new FilesystemStore(),
 *   indexNames: ["react", "docs"],
 * });
 * ```
 */
export async function runMCPServer(config: MCPServerConfig): Promise<void> {
  const server = await createMCPServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

