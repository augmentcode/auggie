# FileSystem Context Example

Local directory search via MCP protocol with AI-powered Q&A and code review.

## Prerequisites

Install the `auggie` CLI:
```bash
auggie --version
```

## Usage

```bash
# Authenticate (for AI features)
auggie login

# Run the example (from the context directory)
cd examples/python-sdk/context
python -m filesystem_context

# Or run directly
python filesystem_context/main.py
```

## What It Does

- Spawns `auggie --mcp` process for file system operations
- Searches local directories without explicit indexing
- Uses `search_and_ask()` for AI Q&A about the workspace
- Performs AI-powered code review
- Explains code patterns

## Key Features

- **`search()`**: Semantic search over local files
- **`search_and_ask()`**: One-step AI Q&A about workspace
- **MCP Protocol**: Standardized context access
- **Auto-indexing**: Files indexed on-the-fly

