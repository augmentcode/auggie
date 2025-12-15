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
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { SearchClient } from "./search-client.js";
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
export async function createMCPServer(config) {
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
    const server = new Server({
        name: config.name ?? "context-connectors",
        version: config.version ?? "0.1.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = [
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
            tools.push({
                name: "list_files",
                description: "List all files in the indexed codebase",
                inputSchema: {
                    type: "object",
                    properties: {
                        pattern: {
                            type: "string",
                            description: "Optional glob pattern to filter files (e.g., '**/*.ts')",
                        },
                    },
                    required: [],
                },
            }, {
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
            });
        }
        return { tools };
    });
    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            switch (name) {
                case "search": {
                    const result = await client.search(args?.query, {
                        maxOutputLength: args?.maxChars,
                    });
                    return {
                        content: [
                            { type: "text", text: result.results || "No results found." },
                        ],
                    };
                }
                case "list_files": {
                    const files = await client.listFiles({
                        pattern: args?.pattern,
                    });
                    const text = files.map((f) => f.path).join("\n");
                    return {
                        content: [{ type: "text", text: text || "No files found." }],
                    };
                }
                case "read_file": {
                    const result = await client.readFile(args?.path);
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
        }
        catch (error) {
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
export async function runMCPServer(config) {
    const server = await createMCPServer(config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
//# sourceMappingURL=mcp-server.js.map