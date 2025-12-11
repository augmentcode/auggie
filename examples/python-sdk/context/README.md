# Context Examples

Examples demonstrating the Auggie SDK's context modes and AI-powered code analysis.

## Prerequisites

1. **Python 3.9+** - Required to run the examples
2. **Auggie CLI** - Required for FileSystem Context examples
   ```bash
   pip install auggie
   # or
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

## Examples

### [Direct Context](./direct_context/)
API-based indexing with semantic search and AI Q&A.

**Run it:**
```bash
python direct_context/main.py
```

### [FileSystem Context](./filesystem_context/)
Local directory search via MCP protocol.

**Important:** The FileSystem Context indexes all files in the workspace directory. To avoid timeouts when indexing large directories (like `node_modules/`), consider adding a `.gitignore` or `.augmentignore` file that excludes them. The auggie CLI respects both `.gitignore` and `.augmentignore` patterns during indexing.

**Run it:**
```bash
python filesystem_context/main.py
```

### [File Search Server](./file_search_server/)
REST API for semantic file search with AI summarization.

**Run it:**
```bash
python file_search_server/main.py [workspace-directory]
```

Then query the API:
```bash
curl "http://localhost:3000/search?q=python"
```

### [Prompt Enhancer Server](./prompt_enhancer_server/)
HTTP server that enhances prompts with codebase context.

**Run it:**
```bash
python prompt_enhancer_server/main.py [workspace-directory]
```

Then enhance prompts:
```bash
curl -X POST http://localhost:3001/enhance \
  -H "Content-Type: application/json" \
  -d '{"prompt": "fix the login bug"}'
```

### [GitHub Action Indexer](./github_action_indexer/)
Index GitHub repositories for semantic search.

This example has its own requirements.txt and dependencies.

**Setup:**
```bash
cd github_action_indexer
pip install -r requirements.txt
```

**Run it:**
```bash
python src/main.py
python src/search.py "your query"
```

See [github_action_indexer/README.md](./github_action_indexer/README.md) for more details.

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

