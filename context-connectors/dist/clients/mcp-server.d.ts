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
import type { IndexStoreReader } from "../stores/types.js";
import type { Source } from "../sources/types.js";
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
export declare function createMCPServer(config: MCPServerConfig): Promise<Server>;
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
export declare function runMCPServer(config: MCPServerConfig): Promise<void>;
//# sourceMappingURL=mcp-server.d.ts.map