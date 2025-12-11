# File Search Server Example

REST API for semantic file search with AI-powered summarization.

## Prerequisites

Install the `auggie` CLI and authenticate:
```bash
npm install -g @augmentcode/auggie@prerelease
auggie login
```

## Usage

```bash
# From the context directory
cd examples/python-sdk/context
python -m file_search_server .

# Or run directly
python file_search_server/main.py .
```

## API Endpoints

### Search Files
```bash
curl "http://localhost:3000/search?q=python"
curl "http://localhost:3000/search?q=authentication+logic"
```

### Health Check
```bash
curl "http://localhost:3000/health"
```

