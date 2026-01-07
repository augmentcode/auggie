# Context Connectors

An open-source library built on the Context Engine SDK that makes diverse sources searchable across agents and apps.

## Features

- **Multiple Sources**: Index code, documentation, runbooks, schemas, and configs from GitHub, GitLab, BitBucket, or websites
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

# Index a GitHub repository
export GITHUB_TOKEN='your-github-token'
npx context-connectors index github --owner myorg --repo myrepo -i my-project

# Index a BitBucket repository
export BITBUCKET_TOKEN='your-bitbucket-token'
npx context-connectors index bitbucket --workspace myworkspace --repo myrepo -i my-project

# Index a website
npx context-connectors index website --url https://docs.example.com -i my-docs
```

### 2. Search

```bash
# Search and get an AI-generated answer (default)
npx context-connectors search "authentication logic" -i my-project

# Get raw search results without AI processing
npx context-connectors search "API routes" -i my-project --raw
```

### 3. Interactive Agent

```bash
npx context-connectors agent -i my-project --provider openai
```

## CLI Commands

### `index` - Index a data source

```bash
context-connectors index <source> [options]
```

| Source | Description |
|--------|-------------|
| `github` | Index a GitHub repository |
| `gitlab` | Index a GitLab project |
| `bitbucket` | Index a Bitbucket repository |
| `website` | Crawl and index a website |

Common options for all sources:

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --index <name>` | Index name | - |
| `--store <type>` | Store type: `filesystem`, `s3` | `filesystem` |
| `--store-path <path>` | Filesystem store path | Platform-specific |

#### GitHub-specific options

| Option | Description | Default |
|--------|-------------|---------|
| `--owner <owner>` | Repository owner (required) | - |
| `--repo <repo>` | Repository name (required) | - |
| `--ref <ref>` | Branch, tag, or commit | `HEAD` |

#### GitLab-specific options

| Option | Description | Default |
|--------|-------------|---------|
| `--project <id>` | Project ID or path, e.g., `group/project` (required) | - |
| `--ref <ref>` | Branch, tag, or commit | `HEAD` |
| `--gitlab-url <url>` | GitLab base URL (for self-hosted) | `https://gitlab.com` |

#### BitBucket-specific options

| Option | Description | Default |
|--------|-------------|---------|
| `--workspace <slug>` | Workspace slug (required) | - |
| `--repo <repo>` | Repository name (required) | - |
| `--ref <ref>` | Branch, tag, or commit | `HEAD` |
| `--bitbucket-url <url>` | Bitbucket base URL (for Server/Data Center) | `https://api.bitbucket.org/2.0` |

#### Website-specific options

| Option | Description | Default |
|--------|-------------|---------|
| `--url <url>` | Website URL to crawl (required) | - |
| `--max-depth <n>` | Maximum crawl depth | `3` |
| `--max-pages <n>` | Maximum pages to crawl | `100` |
| `--include <patterns...>` | URL patterns to include (glob) | - |
| `--exclude <patterns...>` | URL patterns to exclude (glob) | - |
| `--save-content <dir>` | [Debug] Save crawled content to directory | - |

### `search` - Search indexed content

```bash
context-connectors search <query> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --index <spec>` | Index spec: name, path:/path, or s3://bucket/key (required) | - |
| `--raw` | Return raw search results instead of AI-generated answer | `false` |
| `--max-chars <n>` | Max output characters (only with `--raw`) | - |

### `agent` - Interactive AI agent

```bash
context-connectors agent [query] [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --index <specs...>` | Index spec(s): name, path:/path, or s3://bucket/key (required) | - |
| `--provider <name>` | LLM provider: `openai`, `anthropic`, `google` (required) | - |
| `--model <name>` | Model to use | Provider default |
| `--max-steps <n>` | Max agent steps | `10` |
| `-v, --verbose` | Show tool calls | `false` |
| `--search-only` | Disable list_files/read_file tools | `false` |
| `--print` | Non-interactive mode: print response and exit | `false` |

Provider default models:
- `openai`: `gpt-5-mini`
- `anthropic`: `claude-haiku-4-5`
- `google`: `gemini-3-flash-preview`

### `local` - Manage local indexes

```bash
context-connectors local <subcommand>
```

#### `local list` - List local indexes

```bash
context-connectors local list [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--store-path <path>` | Store base path | `~/.augment/context-connectors` |

#### `local delete` - Delete a local index

```bash
context-connectors local delete <name> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--store-path <path>` | Store base path | `~/.augment/context-connectors` |


### `mcp stdio` - Start MCP server with stdio transport

```bash
context-connectors mcp stdio [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --index <specs...>` | Index spec(s): name, path:/path, or s3://bucket/key | - |
| `--search-only` | Disable file operations | `false` |


### `mcp http` - Start MCP server with HTTP transport

Start an MCP server accessible over HTTP for remote clients.

```bash
context-connectors mcp http [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --index <specs...>` | Index spec(s): name, path:/path, or s3://bucket/key | - |
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
context-connectors mcp http -i my-project --port 8080 --cors "*"

# With authentication
context-connectors mcp http -i my-project --api-key "secret-key"

# Or use environment variable for the key
MCP_API_KEY="secret-key" context-connectors mcp http -i my-project
```

### About `--search-only`

By default, all commands provide the `list_files` and `read_file` tools in addition to `search`. Use `--search-only` to disable file operations and provide only the `search` tool.

## Programmatic Usage

### Basic Indexing

```typescript
import { Indexer } from "@augmentcode/context-connectors";
import { GitHubSource } from "@augmentcode/context-connectors/sources";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

const source = new GitHubSource({ owner: "myorg", repo: "myrepo" });
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

> **Important:** You must call `await client.initialize()` before calling `search()`. This loads the index state and prepares the client for queries. Calling `search()` or `getMetadata()` before initialization will throw a "Client not initialized" error.

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


## Security Considerations

### MCP HTTP Server Security

The remote MCP server uses **HTTP without TLS** by default. This has important security implications:

⚠️ **API keys and all data are transmitted in cleartext** when using plain HTTP. This means anyone who can observe network traffic (via MITM attacks, network sniffing, etc.) can capture credentials and data.

#### Recommended Deployments

**For Development (localhost only)**

When binding to `localhost` (the default), traffic never leaves your machine:

```bash
# Safe: localhost only (default)
context-connectors mcp http -i my-project --api-key "$MCP_API_KEY"
```

**For Production: Use a TLS-Terminating Reverse Proxy**

Place the MCP server behind a reverse proxy that handles TLS. Here's an example with Caddy (which automatically obtains certificates):

```
# Caddyfile
mcp.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Then run the MCP server on localhost:

```bash
context-connectors mcp http -i my-project --api-key "$MCP_API_KEY" --port 3000
```

**Alternative: nginx with Let's Encrypt**

```nginx
server {
    listen 443 ssl;
    server_name mcp.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/mcp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.yourdomain.com/privkey.pem;
    
    location /mcp {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # For SSE streaming
        proxy_buffering off;
        proxy_cache off;
    }
}
```

**Alternative: SSH Tunneling**

For ad-hoc remote access, use SSH port forwarding:

```bash
# On the server
context-connectors mcp http -i my-project --api-key "$MCP_API_KEY"

# On your local machine
ssh -L 3000:localhost:3000 user@server

# Now connect to localhost:3000 on your local machine
```

#### Network Isolation

If TLS isn't feasible, ensure the server runs within:
- A private VPC/network with no public internet access
- A trusted network segment with firewall rules limiting access
- A Docker network or Kubernetes cluster with network policies

#### Authentication

Always use an API key for any non-localhost deployment:

```bash
# Set via environment variable (recommended - avoids key in shell history)
export MCP_API_KEY="your-secure-random-key"
context-connectors mcp http -i my-project

# Or via command line option
context-connectors mcp http -i my-project --api-key "your-secure-random-key"
```

Generate a secure key with:

```bash
openssl rand -base64 32
```

## Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-project": {
      "command": "npx",
      "args": ["context-connectors", "mcp", "stdio", "-i", "my-project"],
      "env": {
        "AUGMENT_API_TOKEN": "your-token",
        "AUGMENT_API_URL": "https://your-tenant.api.augmentcode.com/"
      }
    }
  }
}
```

## Remote MCP Client Integration

The `mcp http` command exposes your indexed data over HTTP using the MCP Streamable HTTP transport. Any MCP-compatible client can connect.

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
            -i ${{ github.ref_name }}
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
| `OPENAI_API_KEY` | OpenAI API key | Agent (openai provider) |
| `ANTHROPIC_API_KEY` | Anthropic API key | Agent (anthropic provider) |
| `GOOGLE_API_KEY` | Google API key | Agent (google provider) |
| `AWS_ACCESS_KEY_ID` | AWS access key | S3 store |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | S3 store |
| `CC_S3_BUCKET` | S3 bucket name | S3 store |
| `CC_S3_ENDPOINT` | Custom S3 endpoint URL (for MinIO, etc.) | S3-compatible storage |
| `CC_S3_FORCE_PATH_STYLE` | Use path-style URLs (`true`/`false`) | S3-compatible storage |
| `MCP_API_KEY` | API key for MCP HTTP server authentication | MCP HTTP server |
| `CONTEXT_CONNECTORS_STORE_PATH` | Override default store location | Optional |

## Data Storage

By default, indexes are stored in `~/.augment/context-connectors/` on all platforms.

This location aligns with other Augment CLI state:
- `~/.augment/session.json` - authentication
- `~/.augment/settings.json` - user settings
- `~/.augment/rules/` - user rules
- `~/.augment/agents/` - user-defined agents
- `~/.augment/commands/` - custom commands

Override with `--store-path` or the `CONTEXT_CONNECTORS_STORE_PATH` environment variable.

## Architecture

```
Sources → Indexer → Stores → Clients
```

- **Sources**: Fetch files from data sources (GitHub, GitLab, BitBucket, Website)
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

When using S3-compatible services like MinIO, DigitalOcean Spaces, or Backblaze B2, configure via environment variables:

```bash
export CC_S3_BUCKET=my-bucket
export CC_S3_ENDPOINT=http://localhost:9000
export CC_S3_FORCE_PATH_STYLE=true
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin

npx context-connectors index github --owner myorg --repo myrepo -i my-project --store s3
```

| Environment Variable | Description |
|---------------------|-------------|
| `CC_S3_BUCKET` | S3 bucket name |
| `CC_S3_ENDPOINT` | Custom S3 endpoint URL |
| `CC_S3_FORCE_PATH_STYLE` | Use path-style URLs (`true`/`false`, required for MinIO and most S3-compatible services) |

## License

MIT

