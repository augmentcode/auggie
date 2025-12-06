# File Search Server Example

REST API for semantic file search with AI-powered summarization and code explanation.

## Prerequisites

Install the `auggie` CLI:
```bash
auggie --version
```

## Usage

```bash
export AUGMENT_API_TOKEN="your-token"
npx tsx examples/context/file-search-server/index.ts .
```

## API Endpoints

### Search Files
```bash
curl "http://localhost:3000/search?q=typescript"
curl "http://localhost:3000/search?q=package.json&format=text"
```

### Summarize (AI)
```bash
curl -X POST http://localhost:3000/summarize \
  -H "Content-Type: application/json" \
  -d '{"query":"authentication logic"}'
```

### Explain Code (AI)
```bash
curl -X POST http://localhost:3000/explain \
  -H "Content-Type: application/json" \
  -d '{"path":"src/auth.ts"}'
```

### Health Check
```bash
curl "http://localhost:3000/health"
```

