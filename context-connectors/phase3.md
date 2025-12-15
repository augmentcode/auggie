# Phase 3: CLI Search Client

## Overview

This phase implements the first usable client: a CLI that can index a local directory and search it. This validates the end-to-end flow and provides a useful tool for testing.

**Reference Implementation**: `examples/typescript-sdk/context/github-action-indexer/src/search.ts`

**Depends on**: Phase 2 and Phase 2.5 complete

## Goal

Build a CLI that can:
1. `context-connectors index` - Index a local directory
2. `context-connectors search <query>` - Search the indexed content

## Files to Create

### 1. `src/tools/search.ts`

Core search tool logic, decoupled from CLI.

```typescript
import type { ToolContext, SearchOptions } from "./types.js";

export interface SearchResult {
  results: string;  // Formatted search results from DirectContext
  query: string;
}

export async function search(
  ctx: ToolContext,
  query: string,
  options?: SearchOptions
): Promise<SearchResult> {
  const results = await ctx.context.search(query, {
    maxOutputLength: options?.maxOutputLength,
  });
  return { results: results ?? "", query };
}
```

### 2. `src/tools/list-files.ts`

List files tool - requires Source.

```typescript
import type { FileInfo } from "../core/types.js";
import type { ToolContext } from "./types.js";

export interface ListFilesOptions {
  pattern?: string;  // Optional glob pattern filter
}

export async function listFiles(
  ctx: ToolContext,
  options?: ListFilesOptions
): Promise<FileInfo[]> {
  if (!ctx.source) {
    throw new Error("Source not configured. Cannot list files in search-only mode.");
  }
  
  let files = await ctx.source.listFiles();
  
  // Optional: filter by pattern using minimatch
  if (options?.pattern) {
    const { minimatch } = await import("minimatch");
    files = files.filter(f => minimatch(f.path, options.pattern!));
  }
  
  return files;
}
```

### 3. `src/tools/read-file.ts`

Read file tool - requires Source.

```typescript
import type { ToolContext } from "./types.js";

export interface ReadFileResult {
  path: string;
  contents: string | null;
  error?: string;
}

export async function readFile(
  ctx: ToolContext,
  path: string
): Promise<ReadFileResult> {
  if (!ctx.source) {
    throw new Error("Source not configured. Cannot read files in search-only mode.");
  }
  
  const contents = await ctx.source.readFile(path);
  
  if (contents === null) {
    return { path, contents: null, error: "File not found or not readable" };
  }
  
  return { path, contents };
}
```

### 4. `src/tools/index.ts`

Export all tools:

```typescript
export { search, type SearchResult } from "./search.js";
export { listFiles, type ListFilesOptions } from "./list-files.js";
export { readFile, type ReadFileResult } from "./read-file.js";
export * from "./types.js";
```

### 5. `src/clients/search-client.ts`

Client class that wraps Store + optional Source + tools.

```typescript
import { DirectContext } from "@augmentcode/auggie-sdk";
import type { IndexStoreReader } from "../stores/types.js";
import type { Source } from "../sources/types.js";
import type { IndexState } from "../core/types.js";
import type { ToolContext, SearchOptions } from "../tools/types.js";
import { search, listFiles, readFile } from "../tools/index.js";

export interface SearchClientConfig {
  store: IndexStoreReader;
  source?: Source;  // Optional - enables listFiles/readFile
  key: string;
  apiKey?: string;   // Default: process.env.AUGMENT_API_TOKEN
  apiUrl?: string;   // Default: process.env.AUGMENT_API_URL
}

export class SearchClient {
  private store: IndexStoreReader;
  private source: Source | null;
  private key: string;
  private apiKey: string;
  private apiUrl: string;
  
  private context: DirectContext | null = null;
  private state: IndexState | null = null;

  constructor(config: SearchClientConfig) {
    this.store = config.store;
    this.source = config.source ?? null;
    this.key = config.key;
    this.apiKey = config.apiKey ?? process.env.AUGMENT_API_TOKEN ?? "";
    this.apiUrl = config.apiUrl ?? process.env.AUGMENT_API_URL ?? "";
  }

  /** Load the index and initialize DirectContext */
  async initialize(): Promise<void> {
    // Load state from store
    this.state = await this.store.load(this.key);
    if (!this.state) {
      throw new Error(`Index "${this.key}" not found`);
    }
    
    // Validate source matches if provided
    if (this.source) {
      const sourceMeta = await this.source.getMetadata();
      if (sourceMeta.type !== this.state.source.type) {
        throw new Error(`Source type mismatch: expected ${this.state.source.type}, got ${sourceMeta.type}`);
      }
      // Note: identifier check could be relaxed (paths may differ slightly)
    }
    
    // Import DirectContext from state (write to temp file, import, delete)
    const tempFile = `/tmp/cc-state-${Date.now()}.json`;
    const { promises: fs } = await import("node:fs");
    await fs.writeFile(tempFile, JSON.stringify(this.state.contextState));
    this.context = await DirectContext.importFromFile(tempFile, {
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
    });
    await fs.unlink(tempFile);
  }

  private getToolContext(): ToolContext {
    if (!this.context || !this.state) {
      throw new Error("Client not initialized. Call initialize() first.");
    }
    return { context: this.context, source: this.source, state: this.state };
  }

  async search(query: string, options?: SearchOptions) {
    return search(this.getToolContext(), query, options);
  }

  async listFiles(options?: { pattern?: string }) {
    return listFiles(this.getToolContext(), options);
  }

  async readFile(path: string) {
    return readFile(this.getToolContext(), path);
  }
  
  /** Get index metadata */
  getMetadata() {
    if (!this.state) throw new Error("Client not initialized");
    return this.state.source;
  }
}
```

### 6. `src/bin/index.ts`

Main CLI entry point using Commander.

```typescript
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("context-connectors")
  .description("Index and search any data source with Augment's context engine")
  .version("0.1.0");

// Import subcommands
import "./cmd-index.js";
import "./cmd-search.js";

program.parse();
```

### 7. `src/bin/cmd-index.ts`

Index command implementation.

```typescript
import { Command } from "commander";
import { Indexer } from "../core/indexer.js";
import { FilesystemSource } from "../sources/filesystem.js";
import { FilesystemStore } from "../stores/filesystem.js";

const program = new Command();

program
  .command("index")
  .description("Index a data source")
  .requiredOption("-s, --source <type>", "Source type (filesystem)")
  .requiredOption("-k, --key <name>", "Index key/name")
  .option("-p, --path <path>", "Path for filesystem source", ".")
  .option("--store <type>", "Store type (filesystem)", "filesystem")
  .option("--store-path <path>", "Store base path", ".context-connectors")
  .action(async (options) => {
    try {
      // Create source
      let source;
      if (options.source === "filesystem") {
        source = new FilesystemSource({ rootPath: options.path });
      } else {
        console.error(`Unknown source type: ${options.source}`);
        process.exit(1);
      }

      // Create store
      let store;
      if (options.store === "filesystem") {
        store = new FilesystemStore({ basePath: options.storePath });
      } else {
        console.error(`Unknown store type: ${options.store}`);
        process.exit(1);
      }

      // Run indexer
      console.log(`Indexing ${options.source} source...`);
      const indexer = new Indexer();
      const result = await indexer.index(source, store, options.key);

      console.log(`\nIndexing complete!`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Files indexed: ${result.filesIndexed}`);
      console.log(`  Files removed: ${result.filesRemoved}`);
      console.log(`  Duration: ${result.duration}ms`);
    } catch (error) {
      console.error("Indexing failed:", error);
      process.exit(1);
    }
  });

export { program };
```

### 8. `src/bin/cmd-search.ts`

Search command implementation.

```typescript
import { Command } from "commander";
import { SearchClient } from "../clients/search-client.js";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";

const program = new Command();

program
  .command("search <query>")
  .description("Search indexed content")
  .requiredOption("-k, --key <name>", "Index key/name")
  .option("--store <type>", "Store type (filesystem)", "filesystem")
  .option("--store-path <path>", "Store base path", ".context-connectors")
  .option("--max-chars <number>", "Max output characters", parseInt)
  .option("--with-source", "Enable listFiles/readFile (requires source config)")
  .option("-p, --path <path>", "Path for filesystem source (with --with-source)")
  .action(async (query, options) => {
    try {
      // Create store
      let store;
      if (options.store === "filesystem") {
        store = new FilesystemStore({ basePath: options.storePath });
      } else {
        console.error(`Unknown store type: ${options.store}`);
        process.exit(1);
      }

      // Optionally create source
      let source;
      if (options.withSource) {
        // Load state to get source metadata
        const state = await store.load(options.key);
        if (!state) {
          console.error(`Index "${options.key}" not found`);
          process.exit(1);
        }

        if (state.source.type === "filesystem") {
          const path = options.path ?? state.source.identifier;
          source = new FilesystemSource({ rootPath: path });
        }
      }

      // Create client
      const client = new SearchClient({
        store,
        source,
        key: options.key,
      });

      await client.initialize();

      const meta = client.getMetadata();
      console.log(`Searching index: ${options.key}`);
      console.log(`Source: ${meta.type}://${meta.identifier}`);
      console.log(`Last synced: ${meta.syncedAt}\n`);

      const result = await client.search(query, {
        maxOutputLength: options.maxChars,
      });

      if (!result.results || result.results.trim().length === 0) {
        console.log("No results found.");
        return;
      }

      console.log("Results:\n");
      console.log(result.results);
    } catch (error) {
      console.error("Search failed:", error);
      process.exit(1);
    }
  });

export { program };
```

### 9. Update `package.json`

Add bin entry and scripts:

```json
{
  "bin": {
    "context-connectors": "./dist/bin/index.js"
  },
  "scripts": {
    "cli": "tsx src/bin/index.ts",
    "cli:index": "tsx src/bin/index.ts index",
    "cli:search": "tsx src/bin/index.ts search"
  }
}
```

## Acceptance Criteria

- [ ] `npm run build` compiles without errors
- [ ] `npm run cli index -s filesystem -p . -k myindex` creates an index
- [ ] `npm run cli search "query" -k myindex` returns results
- [ ] Search works without Source configured
- [ ] ListFiles/ReadFile throw appropriate error when Source not configured
- [ ] All tools have corresponding tests

## Testing

### `src/tools/search.test.ts`
- Returns results from DirectContext.search
- Passes maxOutputLength option

### `src/tools/list-files.test.ts`
- Throws error when source is null
- Returns file list from source
- Filters by pattern when provided

### `src/tools/read-file.test.ts`
- Throws error when source is null
- Returns file contents
- Returns error for missing file

### `src/clients/search-client.test.ts`
- Initializes from store
- Search works after initialize
- ListFiles throws when no source
- Validates source type matches

### Integration test
- Index a test directory
- Search returns relevant results
- Verify with real API (skip if no credentials)

## CLI Usage Examples

```bash
# Index current directory
npm run cli index -s filesystem -p . -k my-project

# Search the index
npm run cli search "authentication" -k my-project

# Search with character limit
npm run cli search "database queries" -k my-project --max-chars 5000

# Search with source (enables future listFiles/readFile commands)
npm run cli search "config" -k my-project --with-source -p .
```

## Notes

- Commander is already a dependency from Phase 1
- Use `tsx` for development, compiled JS for production
- The `--with-source` flag is optional for search but required for future agent commands
- Consider adding `--json` flag for machine-readable output in future

