# Context Connectors

An open-source library built on the Context Engine SDK that makes diverse sources searchable across agents and apps.

## Features

- **Multiple Sources**: Index code, documentation, runbooks, schemas, and configs from GitHub, GitLab, BitBucket, websites, or local filesystem
- **Flexible Storage**: Store indexes locally or in S3 for persistent storage in production apps
- **Multiple Clients**: CLI search, interactive agent, MCP server (local & remote)
- **Incremental Updates**: Only re-index what changed
- **Smart Filtering**: Respects `.gitignore`, `.augmentignore`, and filters binary/generated files

## Installation

```bash
npm install @augmentcode/context-connectors
```

Install optional dependencies based on your use case:

```bash
# For GitHub source
npm install @octokit/rest

# For S3 storage
npm install @aws-sdk/client-s3

# For MCP server (Claude Desktop)
npm install @modelcontextprotocol/sdk
```

## Quick Start

### 1. Index Your Codebase

```bash
# Set required environment variables
export AUGMENT_API_TOKEN='your-token'
export AUGMENT_API_URL='https://your-tenant.api.augmentcode.com/'

# Index a local directory
npx context-connectors index filesystem -p /path/to/project -n my-project

# Index a GitHub repository
export GITHUB_TOKEN='your-github-token'
npx context-connectors index github --owner myorg --repo myrepo -n my-project

# Index a BitBucket repository
export BITBUCKET_TOKEN='your-bitbucket-token'
npx context-connectors index bitbucket --workspace myworkspace --repo myrepo -n my-project
```

### 2. Search

```bash
# Search with file reading (default)
npx context-connectors search "authentication logic" -n my-project

# Search only (no file operations)
npx context-connectors search "API routes" -n my-project --search-only
```

### 3. Interactive Agent

```bash
npx context-connectors agent -n my-project
```

## CLI Commands

### `index` - Index a data source

```bash
context-connectors index <source> [options]
```

| Source | Description |
|--------|-------------|
| `filesystem` (alias: `fs`) | Index local filesystem |
| `github` | Index a GitHub repository |
| `gitlab` | Index a GitLab project |
| `bitbucket` | Index a Bitbucket repository |
| `website` | Crawl and index a website |

Common options for all sources:

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Index name | Required |
| `--store <type>` | Store type: `filesystem`, `s3` | `filesystem` |
| `--store-path <path>` | Filesystem store path | Platform-specific |
| `--bucket <name>` | S3 bucket name | - |

### `sync` - Update existing indexes

```bash
context-connectors sync [name] [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `[name]` | Index name to sync | - |
| `-a, --all` | Sync all indexes | `false` |

The `sync` command re-indexes using the stored configuration, fetching the latest content from the source.

### `search` - Search indexed content

```bash
context-connectors search <query> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Index name | Required |
| `--max-chars <n>` | Max output characters | - |
| `--search-only` | Disable file operations | `false` |
| `-p, --path <path>` | Path override for filesystem source | - |

### `agent` - Interactive AI agent

```bash
context-connectors agent [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Index name | Required |
| `--model <name>` | OpenAI model | `gpt-4o` |
| `--max-steps <n>` | Max agent steps | `10` |
| `-v, --verbose` | Show tool calls | `false` |
| `-q, --query <query>` | Single query (non-interactive) | - |
| `--search-only` | Disable file operations | `false` |
| `-p, --path <path>` | Path override for filesystem source | - |

### `mcp` - Start MCP server

```bash
context-connectors mcp [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Index name | Required |
| `--search-only` | Disable file operations | `false` |
| `-p, --path <path>` | Path override for filesystem source | - |

### `mcp-serve` - Start MCP HTTP server

Start an MCP server accessible over HTTP for remote clients.

```bash
context-connectors mcp-serve [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Index name | Required |
| `--port <number>` | Port to listen on | `3000` |
| `--host <host>` | Host to bind to | `localhost` |
| `--cors <origins>` | CORS origins (comma-separated or `*`) | - |
| `--base-path <path>` | Base path for MCP endpoint | `/mcp` |
| `--api-key <key>` | API key for authentication | - |
| `--store <type>` | Store type: `filesystem`, `s3` | `filesystem` |
| `--store-path <path>` | Store base path | Platform-specific |
| `--search-only` | Disable file operations | `false` |

Example:
```bash
# Start server on port 8080, allow any CORS origin
context-connectors mcp-serve -n my-project --port 8080 --cors "*"

# With authentication
context-connectors mcp-serve -n my-project --api-key "secret-key"

# Or use environment variable for the key
MCP_API_KEY="secret-key" context-connectors mcp-serve -n my-project
```

### About `--search-only`

By default, all commands provide the `list_files` and `read_file` tools in addition to `search`. Use `--search-only` to disable file operations and provide only the `search` tool.

For filesystem sources, you can use `-p, --path` to override the source path if it differs from when the index was created.

## Programmatic Usage

### Basic Indexing

```typescript
import { Indexer } from "@augmentcode/context-connectors";
import { FilesystemSource } from "@augmentcode/context-connectors/sources";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

const source = new FilesystemSource({ rootPath: "./my-project" });
const store = new FilesystemStore({ basePath: ".context-connectors" });
const indexer = new Indexer();

const result = await indexer.index(source, store, "my-project");
console.log(`Indexed ${result.filesIndexed} files`);
```

### Search Client

```typescript
import { SearchClient } from "@augmentcode/context-connectors";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

const store = new FilesystemStore({ basePath: ".context-connectors" });
const client = new SearchClient({ store, indexName: "my-project" });
await client.initialize(); // Required before calling search()

const result = await client.search("authentication");
console.log(result.results);
```

> **Important:** You must call `await client.initialize()` before calling `search()`. This loads the index state and prepares the client for queries.

### MCP Server

```typescript
import { runMCPServer } from "@augmentcode/context-connectors";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

const store = new FilesystemStore({ basePath: ".context-connectors" });

await runMCPServer({
  store,
  indexName: "my-project",
});
```

### MCP HTTP Server

```typescript
import { runMCPHttpServer } from "@augmentcode/context-connectors";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

const store = new FilesystemStore({ basePath: ".context-connectors" });

const server = await runMCPHttpServer({
  store,
  indexName: "my-project",
  port: 3000,
  host: "0.0.0.0",
  cors: "*",
  apiKey: process.env.MCP_API_KEY,
});

console.log(`MCP server running at ${server.getUrl()}`);

// Graceful shutdown
process.on("SIGTERM", () => server.stop());
```

## Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-project": {
      "command": "npx",
      "args": ["context-connectors", "mcp", "-n", "my-project", "-p", "/path/to/project"],
      "env": {
        "AUGMENT_API_TOKEN": "your-token",
        "AUGMENT_API_URL": "https://your-tenant.api.augmentcode.com/"
      }
    }
  }
}
```

## Remote MCP Client Integration

The `mcp-serve` command exposes your indexed data over HTTP using the MCP Streamable HTTP transport. Any MCP-compatible client can connect.

### Connecting with MCP SDK

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp"),
  {
    requestInit: {
      headers: {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
);

const client = new Client({ name: "my-client", version: "1.0.0" });
await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log(tools);

// Call search tool
const result = await client.callTool("search", { query: "authentication" });
console.log(result);
```

### Testing with curl

```bash
# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Call search tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search","arguments":{"query":"authentication"}}}'
```

## GitHub Actions

Automate indexing on every push:

```yaml
name: Index Repository

on:
  push:
    branches: [main]

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Index repository
        run: |
          npx @augmentcode/context-connectors index github \
            --owner ${{ github.repository_owner }} \
            --repo ${{ github.event.repository.name }} \
            --ref ${{ github.sha }} \
            -n ${{ github.ref_name }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          AUGMENT_API_TOKEN: ${{ secrets.AUGMENT_API_TOKEN }}
          AUGMENT_API_URL: ${{ secrets.AUGMENT_API_URL }}
```

## GitHub Webhook Integration

Automatically index repositories on push using GitHub webhooks. Supports Vercel/Next.js, Express, and custom frameworks.

### Vercel / Next.js App Router

```typescript
// app/api/webhook/route.ts
import { createVercelHandler } from "@augmentcode/context-connectors/integrations/vercel";
import { S3Store } from "@augmentcode/context-connectors/stores";

const store = new S3Store({ bucket: process.env.INDEX_BUCKET! });

export const POST = createVercelHandler({
  store,
  secret: process.env.GITHUB_WEBHOOK_SECRET!,

  // Only index main branch
  shouldIndex: (event) => event.ref === "refs/heads/main",

  // Log results
  onIndexed: (key, result) => {
    console.log(`Indexed ${key}: ${result.filesIndexed} files`);
  },
});
```

### Express

```typescript
import express from "express";
import { createExpressHandler } from "@augmentcode/context-connectors/integrations/express";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

const app = express();
const store = new FilesystemStore({ basePath: "./indexes" });

// Must use raw body for signature verification
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  createExpressHandler({
    store,
    secret: process.env.GITHUB_WEBHOOK_SECRET!,
  })
);

app.listen(3000);
```

### Custom Framework

```typescript
import {
  createGitHubWebhookHandler,
  verifyWebhookSignature
} from "@augmentcode/context-connectors/integrations";
import { S3Store } from "@augmentcode/context-connectors/stores";

const store = new S3Store({ bucket: "my-indexes" });
const handler = createGitHubWebhookHandler({ store, secret: "..." });

// In your request handler:
async function handleRequest(req: Request) {
  const signature = req.headers.get("x-hub-signature-256")!;
  const eventType = req.headers.get("x-github-event")!;
  const body = await req.text();

  if (!await verifyWebhookSignature(body, signature, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await handler(eventType, JSON.parse(body));
  return Response.json(result);
}
```

### GitHub App Setup

1. Go to **Settings > Developer settings > GitHub Apps > New GitHub App**
2. Set webhook URL to your deployed handler
3. Generate and save the webhook secret
4. Set **Repository contents** permission to **Read**
5. Subscribe to **Push** events
6. Install the app on your repositories

## Environment Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `AUGMENT_API_TOKEN` | Augment API token | All operations |
| `AUGMENT_API_URL` | Augment API URL | All operations |
| `GITHUB_TOKEN` | GitHub access token | GitHub source |
| `GITLAB_TOKEN` | GitLab access token | GitLab source |
| `BITBUCKET_TOKEN` | BitBucket access token | BitBucket source |
| `GITHUB_WEBHOOK_SECRET` | Webhook signature secret | Webhook integration |
| `OPENAI_API_KEY` | OpenAI API key | Agent |
| `AWS_ACCESS_KEY_ID` | AWS access key | S3 store |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | S3 store |
| `CONTEXT_CONNECTORS_STORE_PATH` | Override default store location | Optional |

## Data Storage

By default, indexes are stored in a platform-specific location:

- **Linux**: `~/.local/share/context-connectors`
- **macOS**: `~/Library/Application Support/context-connectors`
- **Windows**: `%LOCALAPPDATA%\context-connectors`

Override with `--store-path` or the `CONTEXT_CONNECTORS_STORE_PATH` environment variable.

## Architecture

```
Sources → Indexer → Stores → Clients
```

- **Sources**: Fetch files from data sources (GitHub, Filesystem, etc.)
- **Indexer**: Orchestrates indexing using Augment's context engine
- **Stores**: Persist index state (Filesystem, S3)
- **Clients**: Consume the index (CLI, Agent, MCP Server via stdio or HTTP)

## Filtering

Files are automatically filtered based on:

1. `.augmentignore` - Custom ignore patterns (highest priority)
2. Built-in filters - Binary files, large files, generated code, secrets
3. `.gitignore` - Standard git ignore patterns

Create a `.augmentignore` file to customize:

```
# Ignore test fixtures
tests/fixtures/

# Ignore generated docs
docs/api/

# Ignore specific files
config.local.json
```

> **Note:** The `.augmentignore` file must be placed in the **source root directory** (the path passed to the add command), not the current working directory.

## Website Source

The website source crawls and indexes static HTML content.

### Limitations

- **JavaScript-rendered content is not supported.** Only static HTML is crawled. Single-page applications (SPAs) or pages that require JavaScript to render content will not be fully indexed.
- Link-based crawling only - pages must be discoverable through links from the starting URL.

## S3-Compatible Storage

When using S3-compatible services like MinIO, DigitalOcean Spaces, or Backblaze B2:

```bash
npx context-connectors index filesystem -p ./project -n my-project \
  --store s3 \
  --bucket my-bucket \
  --s3-endpoint http://localhost:9000 \
  --s3-force-path-style
```

| Option | Description |
|--------|-------------|
| `--s3-endpoint <url>` | Custom S3 endpoint URL |
| `--s3-force-path-style` | Use path-style URLs (required for MinIO and most S3-compatible services) |

## License

MIT

