# Context Connectors - Implementation Plan

A modular system for indexing any data source and making it searchable via Augment's context engine.

## Architecture Overview

```
Sources → Indexer → Stores → Clients
```

- **Sources**: Fetch files from data sources (GitHub, GitLab, Website, Filesystem)
- **Indexer**: Orchestrates indexing using DirectContext from auggie-sdk
- **Stores**: Persist index state (Filesystem, S3, Redis)
- **Clients**: Consume the index (CLI Search, CLI Agent, MCP Server, AI SDK Tools)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Terminology | "Source" not "Ingester" | More intuitive, pairs with "Store" |
| Packaging | Single package + optional peer deps | Simple adoption, no bloat |
| Store interface | Split Reader/Writer | Clients only need read access |
| Source in Client | Optional | Search works without Source; listFiles/readFile need it |
| File list location | Source.listFiles() | Keeps IndexState minimal, allows optimization |
| Tool formats | MCP + AI SDK + Anthropic | Multiple integration options |
| Auth | Env vars only | Simple, CI/CD friendly |
| Watch mode | No | Single walk is sufficient |

## Directory Structure

```
context-connectors/
├── package.json
├── tsconfig.json
├── README.md
├── plan.md
├── src/
│   ├── index.ts                    # Main exports
│   ├── core/
│   │   ├── types.ts                # Shared types & interfaces
│   │   ├── indexer.ts              # Indexing orchestrator
│   │   ├── file-filter.ts          # File filtering logic
│   │   └── utils.ts                # Shared utilities
│   ├── sources/
│   │   ├── types.ts                # Source interface
│   │   ├── github.ts               # GitHub source
│   │   ├── gitlab.ts               # GitLab source
│   │   ├── website.ts              # Website crawler
│   │   └── filesystem.ts           # Local filesystem
│   ├── stores/
│   │   ├── types.ts                # Store interfaces
│   │   ├── filesystem.ts           # Local file storage
│   │   ├── s3.ts                   # AWS S3
│   │   └── redis.ts                # Redis
│   ├── tools/
│   │   ├── types.ts                # Tool interfaces
│   │   ├── search.ts               # Codebase search
│   │   ├── list-files.ts           # List indexed files
│   │   └── read-file.ts            # Read file contents
│   ├── clients/
│   │   ├── cli-search.ts           # Simple search CLI
│   │   ├── cli-agent.ts            # Agent with tool use
│   │   ├── mcp-server.ts           # MCP server
│   │   └── ai-sdk-tools.ts         # Vercel AI SDK tools
│   └── bin/
│       ├── index.ts                # Main CLI entry
│       ├── search.ts               # Search command
│       ├── agent.ts                # Agent command
│       └── mcp.ts                  # MCP server command
├── templates/
│   ├── github-workflow.yml         # GitHub Actions template
│   └── gitlab-ci.yml               # GitLab CI template
└── examples/
    ├── github-action/              # GitHub Action usage
    ├── vercel-ai-agent/            # Vercel AI SDK example
    └── claude-desktop/             # Claude Desktop MCP config
```

---

## Implementation Phases

### Phase 1: Core Foundation
**Goal**: Establish core types, interfaces, and basic infrastructure

- [ ] Create package.json with dependencies and optional peer deps
- [ ] Create tsconfig.json
- [ ] Implement `src/core/types.ts` - IndexState, SourceMetadata, FileEntry, IndexResult
- [ ] Implement `src/sources/types.ts` - Source interface, FileChanges
- [ ] Implement `src/stores/types.ts` - IndexStoreReader, IndexStore interfaces
- [ ] Implement `src/tools/types.ts` - ToolContext, Tools interface
- [ ] Implement `src/core/file-filter.ts` - copy and adapt from existing github-action-indexer
- [ ] Implement `src/core/utils.ts` - shared utilities

### Phase 2: First Source & Store
**Goal**: Get end-to-end indexing working with simplest implementations

- [ ] Implement `src/sources/filesystem.ts` - FilesystemSource
- [ ] Implement `src/stores/filesystem.ts` - FilesystemStore
- [ ] Implement `src/core/indexer.ts` - Indexer class (full + incremental)
- [ ] Implement `src/index.ts` - main exports
- [ ] Write basic tests for filesystem source and store

### Phase 3: CLI Search Client
**Goal**: First usable client for searching indexed content

- [ ] Implement `src/tools/search.ts` - search tool logic
- [ ] Implement `src/tools/list-files.ts` - list files tool logic
- [ ] Implement `src/tools/read-file.ts` - read file tool logic
- [ ] Implement `src/clients/cli-search.ts` - interactive search CLI
- [ ] Implement `src/bin/index.ts` - main CLI with index command
- [ ] Implement `src/bin/search.ts` - search command
- [ ] Test: index local directory, search it

### Phase 4: GitHub Source
**Goal**: Support GitHub repositories as data source

- [ ] Implement `src/sources/github.ts` - GitHubSource with tarball download
- [ ] Add incremental update support via Compare API
- [ ] Add force push detection
- [ ] Add ignore file handling (.gitignore, .augmentignore)
- [ ] Create `templates/github-workflow.yml`
- [ ] Test: index a GitHub repo, search it

### Phase 5: Additional Stores
**Goal**: Support cloud storage backends

- [ ] Implement `src/stores/s3.ts` - S3Store
- [ ] Implement `src/stores/redis.ts` - RedisStore
- [ ] Add store factory function for CLI
- [ ] Test: index with S3 store, index with Redis store

### Phase 6: MCP Server Client
**Goal**: Enable Claude Desktop integration

- [ ] Implement `src/clients/mcp-server.ts` - MCP server with tools
- [ ] Implement `src/bin/mcp.ts` - MCP server command
- [ ] Create `examples/claude-desktop/` - config example
- [ ] Test: connect from Claude Desktop, run searches

### Phase 7: AI SDK Tools Client
**Goal**: Enable Vercel AI SDK integration

- [ ] Implement `src/clients/ai-sdk-tools.ts` - createAISDKTools function
- [ ] Create `examples/vercel-ai-agent/` - usage example
- [ ] Test: use tools with generateText

### Phase 8: CLI Agent Client
**Goal**: Standalone agent with tool use

- [ ] Implement `src/clients/cli-agent.ts` - agent with Anthropic SDK
- [ ] Implement `src/bin/agent.ts` - agent command
- [ ] Test: interactive agent session

### Phase 9: Additional Sources
**Goal**: Support more data sources

- [ ] Implement `src/sources/gitlab.ts` - GitLabSource
- [ ] Create `templates/gitlab-ci.yml`
- [ ] Implement `src/sources/website.ts` - WebsiteSource (crawler)
- [ ] Test: index GitLab repo, index website

### Phase 10: Documentation & Polish
**Goal**: Production-ready release

- [ ] Write comprehensive README.md
- [ ] Document all CLI commands and options
- [ ] Document programmatic API
- [ ] Add JSDoc comments to all public APIs
- [ ] Create examples for common use cases
- [ ] Add CI workflow for the package itself

---

## Key Interfaces Summary

**Source**: Fetches files from a data source
- `fetchAll()` - get all files (for indexing)
- `fetchChanges(previous)` - get changes since last sync, or null (for indexing)
- `getMetadata()` - get source metadata (for indexing)
- `listFiles()` - list all files (for clients)
- `readFile(path)` - read single file (for clients)

**IndexStore** (extends IndexStoreReader): Persists index state
- `load(key)` - load index state
- `save(key, state)` - save index state
- `delete(key)` - delete index state
- `list()` - list available keys

**IndexStoreReader**: Read-only store access (for clients)
- `load(key)` - load index state
- `list()` - list available keys

**Indexer**: Orchestrates indexing
- `index(key)` - perform full or incremental index
- Uses DirectContext from auggie-sdk internally

**Clients**: Consume the index (Source is optional)
- With Source: search, listFiles, readFile all work
- Without Source: only search works (listFiles/readFile throw)

**Tools**: Shared tool implementations
- `search(query, maxChars?)` - semantic search
- `listFiles(pattern?)` - list indexed files (requires Source)
- `readFile(path)` - read file from source (requires Source)

---

## CLI Commands

```bash
# Index a source
context-connectors index --source <type> --store <type> --key <name> [options]

# Search
context-connectors search <query> --key <name> [--store <type>]

# Interactive agent
context-connectors agent --key <name> [--store <type>]

# Start MCP server
context-connectors mcp --key <name> [--store <type>]
```

## Environment Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `AUGMENT_API_TOKEN` | Augment API token | All operations |
| `AUGMENT_API_URL` | Augment API URL | All operations |
| `GITHUB_TOKEN` | GitHub access token | GitHub source |
| `GITLAB_TOKEN` | GitLab access token | GitLab source |
| `AWS_ACCESS_KEY_ID` | AWS access key | S3 store |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | S3 store |
| `REDIS_URL` | Redis connection URL | Redis store |

---

## Testing with GitHub Source

### Token Locations

For local development/testing, tokens are stored at:

| Token | Location | Description |
|-------|----------|-------------|
| GitHub Token | `~/.augment/github_personal_token.2` | GitHub Personal Access Token |
| Augment API Token | Provided per-environment | Augment Context API token |
| Augment API URL | Provided per-environment | Tenant-specific API endpoint |

### Test Command

To test GitHub indexing locally with a real repository:

```bash
cd context-connectors

# Set environment variables
export AUGMENT_API_TOKEN='<your-augment-token>'
export AUGMENT_API_URL='https://staging-shard-0.api.augmentcode.com/'
export GITHUB_TOKEN=$(cat ~/.augment/github_personal_token.2 | tr -d '\n')

# Index a GitHub repository
npx tsx src/bin/index.ts index \
  -s github \
  --owner igor0 \
  --repo lm-plot \
  --ref main \
  -k lm-plot

# Search the indexed content
npx tsx src/bin/index.ts search "plot" -k lm-plot --with-source
```

### Using the CLI Init Command

To set up GitHub Actions in a repository:

```bash
# Navigate to a git repo with GitHub remote
cd /path/to/your/repo

# Run init (auto-detects owner/repo/branch)
npx @augmentcode/context-connectors init

# Or with options
npx @augmentcode/context-connectors init --branch develop --key my-custom-key

# Overwrite existing workflow
npx @augmentcode/context-connectors init --force
```

This creates `.github/workflows/augment-index.yml` and prints next steps for:
1. Setting up repository secrets (AUGMENT_API_TOKEN, AUGMENT_API_URL)
2. Committing and pushing
3. Testing locally

### Test Repositories

| Repo | Description | Good For |
|------|-------------|----------|
| `igor0/lm-plot` | Small Python project (~10 files) | Quick tests |
| `octocat/Hello-World` | Tiny public repo | Integration tests |

