# Using Context Connectors with Claude Desktop

## Prerequisites

1. Install context-connectors globally or use npx
2. Index your codebase first

## Setup

### 1. Index your project

```bash
# Index a local directory
npx @augmentcode/context-connectors index -s filesystem -p /path/to/project -k myproject

# Or index a GitHub repo
npx @augmentcode/context-connectors index -s github --owner myorg --repo myrepo -k myrepo
```

### 2. Configure Claude Desktop

Edit your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "myproject": {
      "command": "npx",
      "args": [
        "@augmentcode/context-connectors",
        "mcp",
        "-k", "myproject",
        "--with-source",
        "-p", "/path/to/project"
      ],
      "env": {
        "AUGMENT_API_TOKEN": "your-token",
        "AUGMENT_API_URL": "https://your-tenant.api.augmentcode.com/"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

The tools will be available in your conversation.

## Available Tools

- **search**: Search the codebase with natural language
- **list_files**: List files in the project (with optional glob pattern)
- **read_file**: Read a specific file's contents

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUGMENT_API_TOKEN` | Your Augment API token |
| `AUGMENT_API_URL` | Your tenant-specific API URL |
| `GITHUB_TOKEN` | Required if using GitHub source with --with-source |

