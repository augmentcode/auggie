# Context Examples

Examples demonstrating the Auggie SDK's context modes and AI-powered code analysis.

## Examples

### [Direct Context](./direct-context/)
API-based indexing with semantic search and AI Q&A.

```bash
auggie login
npx tsx examples/context/direct-context/index.ts
```

### [FileSystem Context](./filesystem-context/)
Local directory search via MCP protocol.

```bash
npx tsx examples/context/filesystem-context/index.ts
```

### [File Search Server](./file-search-server/)
REST API for semantic file search with AI summarization.

```bash
export AUGMENT_API_TOKEN="your-token"
npx tsx examples/context/file-search-server/index.ts .
curl "http://localhost:3000/search?q=typescript"
```

### [Prompt Enhancer Server](./prompt-enhancer-server/)
HTTP server that enhances prompts with codebase context.

```bash
npx tsx examples/context/prompt-enhancer-server/index.ts .
curl -X POST http://localhost:3001/enhance \
  -H "Content-Type: application/json" \
  -d '{"prompt": "fix the login bug"}'
```

## Setup

1. Build the SDK: `npm run build`
2. Authenticate: `auggie login` or set `AUGMENT_API_TOKEN`
3. For FileSystem Context: Install `auggie` CLI

