# Context Examples

Examples demonstrating the Auggie SDK's context modes and AI-powered code analysis.

## Prerequisites

1. **Python 3.10+** - Required to run the examples
2. **Auggie CLI** - Required for FileSystem Context examples
   ```bash
   npm install -g @augmentcode/auggie@prerelease
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

## Examples

### [Direct Context](./direct_context/)
API-based indexing with semantic search and AI Q&A.

**Run it:**
```bash
python -m direct_context
```

### [FileSystem Context](./filesystem_context/)
Local directory search via MCP protocol.

**Important:** The FileSystem Context indexes all files in the workspace directory. To avoid timeouts when indexing large directories (like `node_modules/`), consider adding a `.gitignore` or `.augmentignore` file that excludes them. The auggie CLI respects both `.gitignore` and `.augmentignore` patterns during indexing.

**Run it:**
```bash
python -m filesystem_context
```

### [File Search Server](./file_search_server/)
REST API for semantic file search with AI summarization.

**Run it:**
```bash
python -m file_search_server .
```

Then query the API:
```bash
curl "http://localhost:3000/search?q=python"
```

### [Prompt Enhancer Server](./prompt_enhancer_server/)
HTTP server that enhances prompts with codebase context.

**Run it:**
```bash
python -m prompt_enhancer_server .
```

Then enhance prompts:
```bash
curl -X POST http://localhost:3001/enhance \
  -H "Content-Type: application/json" \
  -d '{"prompt": "fix the login bug"}'
```

### [GitHub Action Indexer](./github_action_indexer/)
Index GitHub repositories with incremental updates via GitHub Actions.

This is a more complex example that demonstrates production-ready repository indexing with GitHub Actions integration. It includes an install script for easy setup in your own repositories.

See [github_action_indexer/README.md](./github_action_indexer/README.md) for setup and usage instructions.

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
__pycache__/
*.pyc
```

The auggie CLI respects both `.gitignore` and `.augmentignore` patterns and will skip excluded files during indexing.

### Authentication Errors

**Problem:** `Error: API key is required for search_and_ask()`

**Cause:** The SDK cannot find your authentication credentials.

**Solution:** Run `auggie login` to authenticate, or set the `AUGMENT_API_TOKEN` and `AUGMENT_API_URL` environment variables.

