/**
 * MCP HTTP Server - Exposes context-connector tools over HTTP transport.
 *
 * Provides HTTP (Streamable HTTP transport) access to the MCP server,
 * allowing remote clients to connect over the network.
 *
 * @module clients/mcp-http-server
 * @see https://modelcontextprotocol.io/
 *
 * @example
 * ```typescript
 * import { runMCPHttpServer } from "@augmentcode/context-connectors/clients";
 * import { FilesystemStore } from "@augmentcode/context-connectors/stores";
 *
 * const server = await runMCPHttpServer({
 *   store: new FilesystemStore(),
 *   indexName: "my-project",
 *   port: 3000,
 * });
 *
 * console.log(`MCP server listening at ${server.getUrl()}`);
 * ```
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createMCPServer, MCPServerConfig } from "./mcp-server.js";

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Authentication result from auth middleware.
 */
interface AuthResult {
  authorized: boolean;
  error?: string;
}

/**
 * Create authentication middleware for API key validation.
 */
function createAuthMiddleware(
  apiKey: string | undefined
): (req: IncomingMessage) => AuthResult {
  return (req: IncomingMessage): AuthResult => {
    if (!apiKey) {
      // No auth configured, allow all requests
      return { authorized: true };
    }

    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return { authorized: false, error: "Missing Authorization header" };
    }

    // Support "Bearer <token>" format
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return { authorized: false, error: "Invalid Authorization header format" };
    }

    const token = match[1];
    if (!safeCompare(token, apiKey)) {
      return { authorized: false, error: "Invalid API key" };
    }

    return { authorized: true };
  };
}

/**
 * Configuration for the MCP HTTP server.
 */
export interface MCPHttpServerConfig extends MCPServerConfig {
  /** Port to listen on. @default 3000 */
  port?: number;

  /** Host to bind to. @default "localhost" */
  host?: string;

  /**
   * CORS origin(s) to allow.
   * Set to "*" for any origin, or specific origin(s).
   * @default undefined (no CORS headers)
   */
  cors?: string | string[];

  /**
   * Base path for MCP endpoint.
   * @default "/mcp"
   */
  basePath?: string;

  /**
   * API key for authentication.
   * When set, clients must provide this key in the Authorization header.
   * Format: "Authorization: Bearer <api-key>"
   */
  apiKey?: string;
}

/**
 * Interface for the MCP HTTP server instance.
 */
export interface MCPHttpServer {
  /** Start the HTTP server */
  start(): Promise<void>;

  /** Stop the HTTP server */
  stop(): Promise<void>;

  /** Get the server URL */
  getUrl(): string;
}

/**
 * Create an MCP HTTP server instance.
 *
 * Creates but does not start the server. Call `start()` to begin listening.
 *
 * @param config - Server configuration
 * @returns MCP HTTP server instance
 */
export async function createMCPHttpServer(
  config: MCPHttpServerConfig
): Promise<MCPHttpServer> {
  const port = config.port ?? 3000;
  const host = config.host ?? "localhost";
  const basePath = config.basePath ?? "/mcp";
  const cors = config.cors;
  const apiKey = config.apiKey;

  // Create auth middleware
  const checkAuth = createAuthMiddleware(apiKey);

  // Store transports by session ID
  const transports: Map<string, StreamableHTTPServerTransport> = new Map();

  // Create the underlying MCP server factory (creates new instance per session)
  const createServerInstance = async (): Promise<Server> => {
    return createMCPServer(config);
  };

  /**
   * Set CORS headers if configured.
   */
  const setCorsHeaders = (req: IncomingMessage, res: ServerResponse): void => {
    if (!cors) return;

    const origin = req.headers.origin;
    if (!origin) return;

    if (cors === "*") {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (Array.isArray(cors)) {
      if (cors.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
    } else if (cors === origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Mcp-Session-Id, Authorization"
    );
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  };

  // Maximum request body size (1MB) to prevent memory exhaustion attacks
  const MAX_BODY_SIZE = 1 * 1024 * 1024;

  /**
   * Parse JSON body from request.
   * Enforces a size limit to prevent DoS attacks via large payloads.
   */
  const parseBody = (req: IncomingMessage): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      let body = "";
      let size = 0;
      let rejected = false;

      req.on("data", (chunk) => {
        if (rejected) return;

        size += chunk.length;
        if (size > MAX_BODY_SIZE) {
          rejected = true;
          req.destroy();
          reject(new Error(`Request body too large (max ${MAX_BODY_SIZE} bytes)`));
          return;
        }
        body += chunk;
      });

      req.on("end", () => {
        if (rejected) return;

        if (!body) {
          resolve(undefined);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error("Invalid JSON body"));
        }
      });

      req.on("error", reject);
    });
  };

  /**
   * Handle HTTP requests.
   */
  const handleRequest = async (
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> => {
    const url = new URL(req.url ?? "/", `http://${host}:${port}`);

    // Set CORS headers
    setCorsHeaders(req, res);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Check if request is for MCP endpoint
    if (!url.pathname.startsWith(basePath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    // Check authentication
    const authResult = checkAuth(req);
    if (!authResult.authorized) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: authResult.error }));
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      if (req.method === "POST") {
        await handlePost(req, res, sessionId);
      } else if (req.method === "GET") {
        await handleGet(req, res, sessionId);
      } else if (req.method === "DELETE") {
        await handleDelete(req, res, sessionId);
      } else {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
      }
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          })
        );
      }
    }
  };

  /**
   * Handle POST requests (JSON-RPC messages).
   */
  const handlePost = async (
    req: IncomingMessage,
    res: ServerResponse,
    sessionId: string | undefined
  ): Promise<void> => {
    const body = await parseBody(req);

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport for this session
      transport = transports.get(sessionId)!;
    } else if (!sessionId && isInitializeRequest(body)) {
      // New initialization request - create new transport and server
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId: string) => {
          transports.set(newSessionId, transport);
        },
        onsessionclosed: (closedSessionId: string) => {
          transports.delete(closedSessionId);
        },
      });

      // Set up cleanup on close
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          transports.delete(sid);
        }
      };

      // Connect the transport to a new MCP server instance
      const server = await createServerInstance();
      await server.connect(transport);
    } else {
      // Invalid request - no session ID or not initialization
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        })
      );
      return;
    }

    await transport.handleRequest(req, res, body);
  };

  /**
   * Handle GET requests (SSE streams).
   */
  const handleGet = async (
    req: IncomingMessage,
    res: ServerResponse,
    sessionId: string | undefined
  ): Promise<void> => {
    if (!sessionId || !transports.has(sessionId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid or missing session ID" }));
      return;
    }

    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
  };

  /**
   * Handle DELETE requests (session termination).
   */
  const handleDelete = async (
    req: IncomingMessage,
    res: ServerResponse,
    sessionId: string | undefined
  ): Promise<void> => {
    if (!sessionId || !transports.has(sessionId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid or missing session ID" }));
      return;
    }

    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
  };

  // Create the HTTP server
  const httpServer = createServer(handleRequest);

  let started = false;

  return {
    async start(): Promise<void> {
      if (started) return;

      return new Promise((resolve, reject) => {
        httpServer.on("error", reject);
        httpServer.listen(port, host, () => {
          started = true;
          resolve();
        });
      });
    },

    async stop(): Promise<void> {
      if (!started) return;

      // Close all active transports
      for (const [sessionId, transport] of transports) {
        try {
          await transport.close();
        } catch {
          // Ignore errors during cleanup
        }
        transports.delete(sessionId);
      }

      // Close the HTTP server
      return new Promise((resolve, reject) => {
        httpServer.close((err) => {
          if (err) reject(err);
          else {
            started = false;
            resolve();
          }
        });
      });
    },

    getUrl(): string {
      return `http://${host}:${port}${basePath}`;
    },
  };
}

/**
 * Run an MCP server with HTTP transport.
 *
 * Convenience function that creates and starts the server.
 * Returns when server is listening.
 *
 * @param config - Server configuration
 * @returns Running MCP HTTP server instance
 *
 * @example
 * ```typescript
 * const server = await runMCPHttpServer({
 *   store: new FilesystemStore(),
 *   indexName: "my-project",
 *   port: 3000,
 *   cors: "*",
 * });
 *
 * console.log(`Server running at ${server.getUrl()}`);
 *
 * // Later, to shut down:
 * await server.stop();
 * ```
 */
export async function runMCPHttpServer(
  config: MCPHttpServerConfig
): Promise<MCPHttpServer> {
  const server = await createMCPHttpServer(config);
  await server.start();
  return server;
}

