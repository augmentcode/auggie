# Direct Context Example

API-based indexing with semantic search, AI Q&A, and state persistence.

## Usage

```bash
# Authenticate
auggie login

# Run the example
python examples/context/direct_context/main.py
```

## What It Does

- Creates a Direct Context instance
- Adds sample files to the index
- Performs semantic searches
- Uses `search_and_ask()` for AI-powered Q&A
- Generates documentation
- Exports/imports context state

## Key Features

- **`search()`**: Semantic search returning formatted code snippets
- **`search_and_ask()`**: One-step AI Q&A about indexed code
- **State persistence**: Export/import index for reuse

