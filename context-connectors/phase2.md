# Phase 2: First Source & Store

## Overview

This phase implements the first working Source (Filesystem) and Store (Filesystem), plus the core Indexer that orchestrates indexing operations. By the end, we'll have end-to-end indexing working.

**Reference Implementation**: Study `examples/typescript-sdk/context/github-action-indexer/` for patterns:
- `src/index-manager.ts` - IndexManager class shows the indexing pattern (adapt to Indexer)
- `src/github-client.ts` - shows file fetching patterns (adapt to FilesystemSource)

**Depends on**: Phase 1 (core types and interfaces)

## Goal

Get end-to-end indexing working: read files from filesystem → index with DirectContext → save state to filesystem.

## Key Design Decisions

### Source is Optional for Clients

Clients (search, agent, MCP) can be initialized with or without a Source:

- **With Source**: Can search, list files, and read files
- **Without Source**: Can only search (listFiles/readFile throw errors)

This allows lightweight "search-only" clients that don't need Source configuration.

```typescript
// Full client
const client = new SearchClient({ store, source, key });

// Search-only client
const client = new SearchClient({ store, key });
client.search("query");    // ✓ works
client.listFiles();        // throws "Source not configured"
```

### Source Provides listFiles()

The `listFiles()` method is on Source (not stored in IndexState) because:
1. IndexState can be optimized to be search-only (smaller, faster to load)
2. File list comes from live source data
3. Keeps IndexState minimal

### Client Validates Source

When Source is provided, Client validates it matches the stored index:
- `source.type` must match `state.source.type`
- `source.identifier` must match `state.source.identifier`
- Throws error on mismatch to prevent using wrong Source

## Prerequisites

- Phase 1 complete (all types and interfaces exist)
- Understanding of `DirectContext` API from `@augmentcode/auggie-sdk`:
  - `DirectContext.create(options)` - create new context
  - `DirectContext.import(state)` - import from saved state  
  - `context.addToIndex(files)` - add files to index
  - `context.removeFromIndex(paths)` - remove files from index
  - `context.export()` - export state for persistence

## Files to Create

### 1. `src/sources/filesystem.ts`

Implements `Source` interface for local filesystem.

**Constructor**: `FilesystemSourceConfig`
- `rootPath: string` - root directory to index
- `ignorePatterns?: string[]` - additional patterns to ignore

**Methods**:

`fetchAll()`:
- Recursively walk `rootPath`
- For each file, check with `shouldFilterFile()` from `file-filter.ts`
- Load `.gitignore` and `.augmentignore` from root if they exist, use `ignore` package
- Return array of `FileEntry` for files that pass filtering
- Skip directories like `.git`, `node_modules` by default

`fetchChanges(previous: SourceMetadata)`:
- Compare file mtimes against `previous.syncedAt`
- Files with mtime > syncedAt are "modified" (or "added" if not in previous index)
- For detecting removed files: would need to track file list in metadata
- For simplicity in Phase 2: return `null` to force full reindex (incremental can be enhanced later)

`getMetadata()`:
- Return `SourceMetadata` with type="filesystem", identifier=rootPath, syncedAt=now

`listFiles()`:
- Walk the directory tree (same logic as fetchAll but without reading contents)
- Return array of `FileInfo` with just the paths
- Apply same filtering as fetchAll

`readFile(path: string)`:
- Join with rootPath, read file, return contents
- Return null if file doesn't exist or is outside rootPath

### 2. `src/stores/filesystem.ts`

Implements `IndexStore` interface using local filesystem.

**Constructor**: `FilesystemStoreConfig`
- `basePath?: string` - directory to store index files (default: `.context-connectors`)

**Storage format**: 
- Each index stored at `{basePath}/{sanitizedKey}/state.json`
- Use `sanitizeKey()` from utils to make key filesystem-safe

**Methods**:

`load(key: string)`:
- Read `{basePath}/{sanitizedKey}/state.json`
- Parse JSON, return `IndexState`
- Return `null` if file doesn't exist

`save(key: string, state: IndexState)`:
- Create directory if needed
- Write `state` as JSON to `{basePath}/{sanitizedKey}/state.json`
- Use pretty-print (2-space indent) for debuggability

`delete(key: string)`:
- Remove the state.json file
- Optionally remove the directory if empty

`list()`:
- Read directories in `basePath`
- Return array of key names (unsanitized if possible, or sanitized names)

### 3. `src/core/indexer.ts`

Main orchestrator that coordinates Source, Store, and DirectContext.

**Constructor**: `IndexerConfig`
- `apiKey?: string` - Augment API key (default: from env `AUGMENT_API_TOKEN`)
- `apiUrl?: string` - Augment API URL (default: from env `AUGMENT_API_URL`)

**Methods**:

`index(source: Source, store: IndexStore, key: string)`:
1. Load previous state from store: `store.load(key)`
2. If no previous state → full index
3. If previous state exists:
   - Try `source.fetchChanges(previousState.source)`
   - If returns null → full index
   - If returns FileChanges → incremental update
4. Return `IndexResult`

`fullIndex(source, store, key)` (private):
1. Create new DirectContext: `DirectContext.create({apiKey, apiUrl})`
2. Fetch all files: `source.fetchAll()`
3. Add to index: `context.addToIndex(files)`
4. Get metadata: `source.getMetadata()`
5. Export and save state: `store.save(key, {contextState: context.export(), source: metadata})`
6. Return result with type="full"

`incrementalIndex(source, store, key, previousState, changes)` (private):
1. Import previous context: `DirectContext.import(previousState.contextState)`
2. Remove deleted files: `context.removeFromIndex(changes.removed)`
3. Add new/modified files: `context.addToIndex([...changes.added, ...changes.modified])`
4. Save updated state
5. Return result with type="incremental"

### 4. `src/index.ts`

Main package entry point. Export everything needed for programmatic use:

```typescript
// Core
export * from "./core/index.js";

// Sources
export * from "./sources/index.js";
export { FilesystemSource } from "./sources/filesystem.js";

// Stores  
export * from "./stores/index.js";
export { FilesystemStore } from "./stores/filesystem.js";

// Indexer
export { Indexer } from "./core/indexer.js";
```

### 5. Update barrel files

Update `src/sources/index.ts`:
- Export `FilesystemSource`

Update `src/stores/index.ts`:
- Export `FilesystemStore`

Update `src/core/index.ts`:
- Export `Indexer`

## Acceptance Criteria

- [ ] `npm run build` compiles without errors
- [ ] Can programmatically: create FilesystemSource → create Indexer → index → state saved
- [ ] Can programmatically: load state from FilesystemStore
- [ ] Indexer correctly skips files that should be filtered
- [ ] All new code has corresponding tests

## Testing

### `src/sources/filesystem.test.ts`
- `fetchAll()` returns files from directory
- `fetchAll()` respects .gitignore
- `fetchAll()` filters binary files
- `fetchAll()` skips node_modules, .git
- `readFile()` returns file contents
- `readFile()` returns null for missing files
- `getMetadata()` returns correct type and identifier

### `src/stores/filesystem.test.ts`
- `save()` creates directory and file
- `load()` returns saved state
- `load()` returns null for missing key
- `delete()` removes state
- `list()` returns saved keys

### `src/core/indexer.test.ts`
- Full index works end-to-end (may need to mock DirectContext or use real API in integration test)
- Consider a simple integration test that indexes a small test directory

## Notes

- For API calls to DirectContext, you'll need valid `AUGMENT_API_TOKEN` and `AUGMENT_API_URL` env vars
- Consider making some tests skip if env vars not set (integration tests)
- The `ignore` package is already a dependency - use it for .gitignore parsing
- File walking should be async using `fs.promises` and `fs.readdir` with `withFileTypes: true`

