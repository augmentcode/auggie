# Context Examples

Examples demonstrating the Auggie SDK's context modes and AI-powered code analysis.

## Prerequisites

1. **Node.js 18+** - Required to run the examples
2. **Auggie CLI** - Required for FileSystem Context examples
   ```bash
   npm install -g @augmentcode/auggie
   ```
3. **Authentication** - Required for all examples
   ```bash
   auggie login
   ```
   This creates a session file at `~/.augment/session.json` with your API token.

   Alternatively, you can set environment variables:
   ```bash
   export AUGMENT_API_TOKEN=your_token_here
   export AUGMENT_API_URL=https://staging-shard-0.api.augmentcode.com/
   ```

## Setup

Install dependencies:

```bash
cd examples/typescript-sdk/context
npm install
```

## Examples

### [Direct Context](./direct-context/)
API-based indexing with semantic search and AI Q&A.

**Run it:**
```bash
npm run direct-context
```

### [FileSystem Context](./filesystem-context/)
Local directory search via MCP protocol.

**Prerequisites:**
- Auggie CLI must be installed and in your PATH
- Authentication via `auggie login` or `AUGMENT_API_TOKEN` environment variable
- A `.gitignore` or `.augmentignore` file in the workspace directory to exclude `node_modules/` and other large directories

**Important:** The FileSystem Context indexes all files in the workspace directory. To avoid timeouts when indexing large directories (like `node_modules/`), make sure you have a `.gitignore` or `.augmentignore` file that excludes them. The auggie CLI respects both `.gitignore` and `.augmentignore` patterns during indexing.

**Run it:**
```bash
npm run filesystem-context
```

### [File Search Server](./file-search-server/)
REST API for semantic file search with AI summarization.

**Prerequisites:** Auggie CLI must be installed and in your PATH.

**Run it:**
```bash
npm run file-search-server [workspace-directory]
```

Then query the API:
```bash
curl "http://localhost:3000/search?q=typescript"
```

### [Prompt Enhancer Server](./prompt-enhancer-server/)
HTTP server that enhances prompts with codebase context.

**Prerequisites:** Auggie CLI must be installed and in your PATH.

**Run it:**
```bash
npm run prompt-enhancer-server [workspace-directory]
```

Then enhance prompts:
```bash
curl -X POST http://localhost:3001/enhance \
  -H "Content-Type: application/json" \
  -d '{"prompt": "fix the login bug"}'
```

### [GitHub Action Indexer](./github-action-indexer/)
Index GitHub repositories for semantic search.

This example has its own package.json and dependencies.

**Setup:**
```bash
npm run github-indexer:install
```

**Run it:**
```bash
npm run github-indexer:index
npm run github-indexer:search
```

See [github-action-indexer/README.md](./github-action-indexer/README.md) for more details.

## Running Examples Directly with tsx

You can also run examples directly without installing dependencies:

```bash
npx tsx direct-context/index.ts
npx tsx filesystem-context/index.ts
npx tsx file-search-server/index.ts .
npx tsx prompt-enhancer-server/index.ts .
```

Note: This will download dependencies on each run. For better performance, use `npm install` first.

## Troubleshooting

### MCP Timeout in FileSystem Context

**Problem:** The FileSystem Context example times out during indexing.

**Cause:** The workspace directory contains too many files (e.g., `node_modules/` with 45,000+ files).

**Solution:** Create a `.gitignore` or `.augmentignore` file in the workspace directory to exclude large directories:

```bash
# .gitignore or .augmentignore
node_modules/
dist/
*.log
.DS_Store
```

The auggie CLI respects both `.gitignore` and `.augmentignore` patterns and will skip excluded files during indexing.

### Authentication Errors

**Problem:** `Error: API key is required for searchAndAsk()`

**Cause:** The SDK cannot find your authentication credentials.

**Solution:** Run `auggie login` to authenticate, or set the `AUGMENT_API_TOKEN` and `AUGMENT_API_URL` environment variables.


