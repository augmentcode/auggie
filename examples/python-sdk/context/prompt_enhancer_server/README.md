# Prompt Enhancer Server Example

HTTP server that enhances vague prompts using AI with codebase context.

## Prerequisites

Install the `auggie` CLI and authenticate:
```bash
npm install -g @augmentcode/auggie@prerelease
auggie login
```

## Usage

```bash
# Start server with workspace directory (from the context directory)
cd examples/python-sdk/context
python -m prompt_enhancer_server .

# Or run directly
python prompt_enhancer_server/main.py .
```

## API Endpoints

### Enhance Prompt
```bash
curl -X POST http://localhost:3001/enhance \
  -H "Content-Type: application/json" \
  -d '{"prompt": "fix the bug"}'
```

Response:
```json
{
  "original": "fix the bug",
  "enhanced": "Fix the bug in the authentication system. Specifically, investigate the login function..."
}
```

### Health Check
```bash
curl "http://localhost:3001/health"
```

