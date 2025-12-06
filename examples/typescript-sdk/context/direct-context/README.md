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
- **Retry logic**: Automatic retry with exponential backoff for failed searches

## Known Issues

### API Search Failures

Some search queries may fail with `"Retrieval failed. Please try again."` This is a known issue with the staging API backend. The example includes retry logic to handle these failures:

- Automatically retries failed searches up to 3 times
- Uses exponential backoff (1s, 2s, 4s delays)
- Logs retry attempts for visibility

**Workaround:** If a query consistently fails after retries, try rephrasing it:
- ❌ "calculator functions for arithmetic" → ✅ "calculator functions"
- ❌ "Calculator class methods" → ✅ "Calculator methods"

See [ISSUE_2_FINDINGS.md](../ISSUE_2_FINDINGS.md) for detailed analysis.

