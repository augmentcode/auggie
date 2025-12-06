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

# Run the example
npx tsx examples/context/filesystem-context/index.ts
```

## What It Does

- Spawns `auggie --mcp` process for file system operations
- Searches local directories without explicit indexing
- Uses `searchAndAsk()` for AI Q&A about the workspace
- Performs AI-powered code review
- Explains code patterns

## Key Features

- **`search()`**: Semantic search over local files
- **`searchAndAsk()`**: One-step AI Q&A about workspace
- **MCP Protocol**: Standardized context access
- **Auto-indexing**: Files indexed on-the-fly

