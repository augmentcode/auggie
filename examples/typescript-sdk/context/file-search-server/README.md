# File Search Server Example

REST API for semantic file search with AI-powered summarization.

## Prerequisites

Install the `auggie` CLI and authenticate:
```bash
npm install -g @augmentcode/auggie@latest
auggie login
```

## Usage

```bash
npx tsx examples/context/file-search-server/index.ts .
```

## API Endpoints

### Search Files
```bash
curl "http://localhost:3000/search?q=typescript"
curl "http://localhost:3000/search?q=authentication+logic"
```

### Health Check
```bash
curl "http://localhost:3000/health"
```

