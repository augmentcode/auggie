# Context Connectors

Index any data source and make it searchable with Augment's context engine.

## Features

- **Multiple Sources**: Index from GitHub, GitLab, websites, or local filesystem
- **Flexible Storage**: Store indexes locally, in S3, or other backends
- **Multiple Clients**: CLI search, interactive agent, MCP server
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
npx context-connectors index -s filesystem -p /path/to/project -k my-project

# Index a GitHub repository
export GITHUB_TOKEN='your-github-token'
npx context-connectors index -s github --owner myorg --repo myrepo -k my-project
```

### 2. Search

```bash
# Simple search
npx context-connectors search "authentication logic" -k my-project

# With file reading capabilities
npx context-connectors search "API routes" -k my-project --with-source -p /path/to/project
```

### 3. Interactive Agent

```bash
npx context-connectors agent -k my-project --with-source -p /path/to/project
```

## CLI Commands

### `index` - Index a data source

```bash
context-connectors index [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --source <type>` | Source type: `filesystem`, `github` | Required |
| `-k, --key <name>` | Index key/name | Required |
| `-p, --path <path>` | Path for filesystem source | `.` |
| `--owner <owner>` | GitHub repository owner | - |
| `--repo <repo>` | GitHub repository name | - |
| `--ref <ref>` | Git ref (branch/tag/commit) | `HEAD` |
| `--store <type>` | Store type: `filesystem`, `s3` | `filesystem` |
| `--store-path <path>` | Filesystem store path | `.context-connectors` |
| `--bucket <name>` | S3 bucket name | - |

### `search` - Search indexed content

```bash
context-connectors search <query> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-k, --key <name>` | Index key/name | Required |
| `--max-chars <n>` | Max output characters | - |
| `--with-source` | Enable file operations | `false` |
| `-p, --path <path>` | Source path (with --with-source) | - |

### `agent` - Interactive AI agent

```bash
context-connectors agent [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-k, --key <name>` | Index key/name | Required |
| `--model <name>` | OpenAI model | `gpt-4o` |
| `--max-steps <n>` | Max agent steps | `10` |
| `-v, --verbose` | Show tool calls | `false` |
| `-q, --query <query>` | Single query (non-interactive) | - |
| `--with-source` | Enable file operations | `false` |

### `mcp` - Start MCP server

```bash
context-connectors mcp [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-k, --key <name>` | Index key/name | Required |
| `--with-source` | Enable file tools | `false` |

### About `--with-source`

The `--with-source` flag enables the `listFiles` and `readFile` tools in addition to `search`. Without this flag, only the `search` tool is available.

When using `--with-source`, you must also provide the source path with `-p, --path` so that files can be read from disk.

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
const client = new SearchClient({ store, key: "my-project" });
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
  key: "my-project",
});
```

## Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-project": {
      "command": "npx",
      "args": ["context-connectors", "mcp", "-k", "my-project", "--with-source", "-p", "/path/to/project"],
      "env": {
        "AUGMENT_API_TOKEN": "your-token",
        "AUGMENT_API_URL": "https://your-tenant.api.augmentcode.com/"
      }
    }
  }
}
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
          npx @augmentcode/context-connectors index \
            -s github \
            --owner ${{ github.repository_owner }} \
            --repo ${{ github.event.repository.name }} \
            --ref ${{ github.sha }} \
            -k ${{ github.ref_name }}
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
| `GITHUB_WEBHOOK_SECRET` | Webhook signature secret | Webhook integration |
| `OPENAI_API_KEY` | OpenAI API key | Agent |
| `AWS_ACCESS_KEY_ID` | AWS access key | S3 store |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | S3 store |

## Architecture

```
Sources → Indexer → Stores → Clients
```

- **Sources**: Fetch files from data sources (GitHub, Filesystem, etc.)
- **Indexer**: Orchestrates indexing using Augment's context engine
- **Stores**: Persist index state (Filesystem, S3)
- **Clients**: Consume the index (CLI, Agent, MCP Server)

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

> **Note:** The `.augmentignore` file must be placed in the **source root directory** (the path passed to the index command), not the current working directory.

## Website Source

The website source crawls and indexes static HTML content.

### Limitations

- **JavaScript-rendered content is not supported.** Only static HTML is crawled. Single-page applications (SPAs) or pages that require JavaScript to render content will not be fully indexed.
- Link-based crawling only - pages must be discoverable through links from the starting URL.

## S3-Compatible Storage

When using S3-compatible services like MinIO, DigitalOcean Spaces, or Backblaze B2:

```bash
npx context-connectors index -s filesystem -p ./project -k my-project \
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

