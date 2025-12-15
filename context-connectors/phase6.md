# Phase 6: MCP Server

## Overview

This phase implements an MCP (Model Context Protocol) server that exposes the context-connectors tools to AI assistants like Claude Desktop. MCP is a standard protocol for connecting AI models to external tools and data sources.

**Reference**: https://modelcontextprotocol.io/

**Depends on**: Phase 5 complete

## Goal

Create an MCP server that:
1. Exposes `search`, `list_files`, and `read_file` tools
2. Works with Claude Desktop and other MCP-compatible clients
3. Can be started via CLI command
4. Loads index from any configured store

## Prerequisites

- Understanding of MCP protocol (see https://modelcontextprotocol.io/docs)
- `@modelcontextprotocol/sdk` package for server implementation

## Files to Create

### 1. Update `package.json`

Add MCP SDK as optional peer dependency:

```json
{
  "peerDependencies": {
    "@modelcontextprotocol/sdk": ">=1.0.0"
  },
  "peerDependenciesMeta": {
    "@modelcontextprotocol/sdk": { "optional": true }
  }
}
```

### 2. `src/clients/mcp-server.ts`

MCP server implementation exposing context-connector tools.

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { IndexStoreReader } from "../stores/types.js";
import type { Source } from "../sources/types.js";
import { SearchClient } from "./search-client.js";

export interface MCPServerConfig {
  store: IndexStoreReader;
  source?: Source;          // Optional - enables list_files/read_file
  key: string;
  name?: string;            // Server name (default: "context-connectors")
  version?: string;         // Server version (default: package version)
}

export async function createMCPServer(config: MCPServerConfig): Promise<Server> {
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
      tools.push(
        {
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
          const result = await client.search(args.query as string, {
            maxOutputLength: args.maxChars as number | undefined,
          });
          return {
            content: [{ type: "text", text: result.results || "No results found." }],
          };
        }

        case "list_files": {
          const files = await client.listFiles({ pattern: args.pattern as string });
          const text = files.map(f => f.path).join("\n");
          return {
            content: [{ type: "text", text: text || "No files found." }],
          };
        }

        case "read_file": {
          const result = await client.readFile(args.path as string);
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

export async function runMCPServer(config: MCPServerConfig): Promise<void> {
  const server = await createMCPServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

### 3. `src/bin/cmd-mcp.ts`

CLI command to start the MCP server.

```typescript
import { Command } from "commander";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";
import { runMCPServer } from "../clients/mcp-server.js";

const program = new Command();

program
  .command("mcp")
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

export { program };
```

### 4. Update `src/bin/index.ts`

Import the MCP command:

```typescript
import "./cmd-mcp.js";
```

### 5. `examples/claude-desktop/README.md`

Documentation for Claude Desktop setup:

```markdown
# Using Context Connectors with Claude Desktop

## Prerequisites

1. Install context-connectors globally or use npx
2. Index your codebase first

## Setup

### 1. Index your project

```bash
# Index a local directory
npx @augmentcode/context-connectors index -s filesystem -p /path/to/project -k myproject

# Or index a GitHub repo
npx @augmentcode/context-connectors index -s github --owner myorg --repo myrepo -k myrepo
```

### 2. Configure Claude Desktop

Edit your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "myproject": {
      "command": "npx",
      "args": [
        "@augmentcode/context-connectors",
        "mcp",
        "-k", "myproject",
        "--with-source",
        "-p", "/path/to/project"
      ],
      "env": {
        "AUGMENT_API_TOKEN": "your-token",
        "AUGMENT_API_URL": "https://your-tenant.api.augmentcode.com/"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

The tools will be available in your conversation.

## Available Tools

- **search**: Search the codebase with natural language
- **list_files**: List files in the project (with optional glob pattern)
- **read_file**: Read a specific file's contents

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUGMENT_API_TOKEN` | Your Augment API token |
| `AUGMENT_API_URL` | Your tenant-specific API URL |
| `GITHUB_TOKEN` | Required if using GitHub source with --with-source |
```

### 6. `examples/claude-desktop/claude_desktop_config.example.json`

Example config file:

```json
{
  "mcpServers": {
    "my-codebase": {
      "command": "npx",
      "args": [
        "@augmentcode/context-connectors",
        "mcp",
        "-k", "my-codebase",
        "--store", "filesystem",
        "--store-path", "/path/to/.context-connectors",
        "--with-source",
        "-p", "/path/to/codebase"
      ],
      "env": {
        "AUGMENT_API_TOKEN": "your-augment-api-token",
        "AUGMENT_API_URL": "https://your-tenant.api.augmentcode.com/"
      }
    }
  }
}
```

## Acceptance Criteria

- [ ] `npm run build` compiles without errors
- [ ] `npm run cli mcp -k <key>` starts server and accepts MCP protocol on stdin/stdout
- [ ] `search` tool returns results
- [ ] `list_files` tool works when source configured
- [ ] `read_file` tool works when source configured
- [ ] Tools return appropriate errors when source not configured
- [ ] Claude Desktop can connect and use tools
- [ ] All tests pass

## Testing

### `src/clients/mcp-server.test.ts`

Test the MCP server logic (mock the transport):

```typescript
import { createMCPServer } from "./mcp-server.js";
import { MemoryStore } from "../stores/memory.js";

describe("MCP Server", () => {
  it("lists search tool", async () => {
    const store = new MemoryStore();
    // ... setup with mock state

    const server = await createMCPServer({ store, key: "test" });
    // Test ListToolsRequest handler
  });

  it("lists file tools when source provided", async () => {
    // Verify list_files and read_file appear when source configured
  });

  it("hides file tools when no source", async () => {
    // Verify only search appears when no source
  });

  it("handles search tool call", async () => {
    // Test CallToolRequest for search
  });

  it("handles list_files tool call", async () => {
    // Test CallToolRequest for list_files
  });

  it("handles read_file tool call", async () => {
    // Test CallToolRequest for read_file
  });

  it("returns error for unknown tool", async () => {
    // Test error handling
  });
});
```

### Manual Testing

1. Start the MCP server manually:
   ```bash
   npm run cli mcp -k myproject --with-source -p .
   ```

2. Send MCP protocol messages on stdin to test

3. Configure Claude Desktop and test interactively

## Notes

- MCP uses JSON-RPC over stdio
- Errors must go to stderr (stdout is for protocol)
- Server should handle graceful shutdown on SIGTERM/SIGINT
- Consider adding `--verbose` flag that logs to stderr
- The `@modelcontextprotocol/sdk` package handles protocol details

