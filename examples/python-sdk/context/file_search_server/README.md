# File Search Server Example

REST API for semantic file search with AI-powered summarization.

## Prerequisites

Install the `auggie` CLI and authenticate:
```bash
pip install auggie
# or
npm install -g @augmentcode/auggie
auggie login
```

## Usage

```bash
python examples/context/file_search_server/main.py .
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

