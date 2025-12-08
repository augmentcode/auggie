# Direct Context Example

API-based indexing with semantic search, AI Q&A, and state persistence.

## Usage

```bash
# Authenticate
auggie login

# Run the example
npx tsx examples/context/direct-context/index.ts
```

## What It Does

- Creates a Direct Context instance
- Adds sample files to the index
- Performs semantic searches
- Uses `searchAndAsk()` for AI-powered Q&A
- Generates documentation
- Exports/imports context state

## Key Features

- **`search()`**: Semantic search returning formatted code snippets
- **`searchAndAsk()`**: One-step AI Q&A about indexed code
- **State persistence**: Export/import index for reuse

