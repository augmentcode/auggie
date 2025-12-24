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

  // Tool descriptions adapted from Auggie CLI
  const searchDescription = `Search the indexed content (${meta.type}://${meta.identifier}) using natural language.
Returns relevant snippets organized by file path with line numbers.

Features:
- Takes a natural language description of what you're looking for
- Returns snippets ranked by relevance
- Works across different file types
- Reflects the indexed state of the content`;

  const listFilesDescription = `List files and directories with type annotations.
* \`directory\` is a path relative to the source root
* Lists files and subdirectories up to 2 levels deep by default
* Hidden files (starting with \`.\`) are excluded by default
* Supports glob pattern filtering (e.g., \`*.ts\`, \`src/*.json\`)
* If the output is long, it will be truncated`;

  const readFileDescription = `Read file contents with line numbers (cat -n format).
* \`path\` is a file path relative to the source root
* Displays output with 6-character padded line numbers
* Use \`startLine\` and \`endLine\` to read a specific range (1-based, inclusive)
* Use \`searchPattern\` for regex search - only matching lines and context will be shown
* Large files are automatically truncated

Regex search:
* Use \`searchPattern\` to search for patterns in the file
* Non-matching sections between matches are replaced with \`...\`
* Supported: \`.\`, \`[abc]\`, \`[a-z]\`, \`^\`, \`$\`, \`*\`, \`+\`, \`?\`, \`{n,m}\`, \`|\`, \`\\t\`
* Not supported: \`\\n\`, \`\\d\`, \`\\s\`, \`\\w\`, look-ahead/behind, back-references`;

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: "search",
        description: searchDescription,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language description of what you're looking for.",
            },
            maxChars: {
              type: "number",
              description: "Maximum characters in response (optional).",
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
          description: listFilesDescription,
          inputSchema: {
            type: "object",
            properties: {
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
            required: [],
          },
        },
        {
          name: "read_file",
          description: readFileDescription,
          inputSchema: {
            type: "object",
            properties: {
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
              errorText += `\n\nDid you mean one of these?\n${result.suggestions.map(s => `  - ${s}`).join("\n")}`;
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

