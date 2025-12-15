# Phase 1: Core Foundation

## Overview

This phase establishes the core types, interfaces, and basic infrastructure for Context Connectors - a modular system for indexing any data source and making it searchable via Augment's context engine.

**Reference Implementation**: Study `examples/typescript-sdk/context/github-action-indexer/` for patterns and existing code to reuse, especially:
- `src/types.ts` - existing type definitions
- `src/file-filter.ts` - file filtering logic (copy and adapt)
- `src/index-manager.ts` - indexing patterns

## Goal

Create the foundational types and interfaces that all other phases will build upon.

## Prerequisites

- Node.js 20+
- Familiarity with TypeScript
- Understanding of the auggie-sdk DirectContext API

## Files to Create

### 1. `package.json`

Create with:
- name: `@augmentcode/context-connectors`
- type: `module` (ESM)
- Dependencies:
  - `@augmentcode/auggie-sdk`: `^0.1.6`
  - `commander`: `^12.0.0`
  - `ignore`: `^5.3.0`
  - `minimatch`: `^9.0.0`
  - `tar`: `^6.2.0`
- Dev dependencies:
  - `@types/node`: `^20.10.0`
  - `@types/tar`: `^6.1.10`
  - `tsx`: `^4.7.0`
  - `typescript`: `^5.3.3`
  - `vitest`: `^1.1.0`
- Optional peer dependencies (all optional):
  - `@anthropic-ai/sdk`: `>=0.30.0`
  - `@aws-sdk/client-s3`: `>=3.0.0`
  - `@octokit/rest`: `>=20.0.0`
  - `ai`: `>=4.0.0`
  - `cheerio`: `>=1.0.0`
  - `ioredis`: `>=5.0.0`
- Scripts: `build`, `dev`, `test`
- Exports for subpath imports: `.`, `./sources`, `./stores`, `./tools`, `./ai-sdk`, `./mcp`

### 2. `tsconfig.json`

Standard TypeScript config for ESM:
- target: `ES2022`
- module: `NodeNext`
- moduleResolution: `NodeNext`
- outDir: `dist`
- rootDir: `src`
- strict: `true`
- declaration: `true`

### 3. `src/core/types.ts`

Core shared types used throughout the system:

```typescript
import type { DirectContextState } from "@augmentcode/auggie-sdk";

/** A file with its contents */
interface FileEntry {
  path: string;
  contents: string;
}

/** Metadata about the data source */
interface SourceMetadata {
  type: "github" | "gitlab" | "website" | "filesystem";
  identifier: string;   // e.g., "owner/repo", URL, or path
  ref?: string;         // Branch/tag/commit for VCS sources
  syncedAt: string;     // ISO timestamp
}

/** Complete index state (stored by IndexStore) */
interface IndexState {
  contextState: DirectContextState;
  source: SourceMetadata;
}

/** Result of an indexing operation */
interface IndexResult {
  type: "full" | "incremental" | "unchanged";
  filesIndexed: number;
  filesRemoved: number;
  duration: number;     // milliseconds
}

/** File info (for listFiles) */
interface FileInfo {
  path: string;
}
```

### 4. `src/sources/types.ts`

Source interface for fetching files from data sources:

```typescript
import type { FileEntry, SourceMetadata, FileInfo } from "../core/types.js";

/** Changes detected since last sync */
interface FileChanges {
  added: FileEntry[];
  modified: FileEntry[];
  removed: string[];    // paths only
}

/** Source: Fetches files from a data source */
interface Source {
  readonly type: SourceMetadata["type"];

  // --- For indexing ---

  /** Fetch all files (for full index) */
  fetchAll(): Promise<FileEntry[]>;

  /** Fetch changes since last sync. Returns null if incremental not possible. */
  fetchChanges(previous: SourceMetadata): Promise<FileChanges | null>;

  /** Get current source metadata */
  getMetadata(): Promise<SourceMetadata>;

  // --- For clients ---

  /** List all files in the source (for list_files tool) */
  listFiles(): Promise<FileInfo[]>;

  /** Read a single file by path (for read_file tool) */
  readFile(path: string): Promise<string | null>;
}
```

### 5. `src/stores/types.ts`

Store interfaces for persisting index state:

```typescript
import type { IndexState } from "../core/types.js";

/** Read-only store interface (sufficient for clients) */
interface IndexStoreReader {
  load(key: string): Promise<IndexState | null>;
  list(): Promise<string[]>;
}

/** Full store interface (needed by indexer) */
interface IndexStore extends IndexStoreReader {
  save(key: string, state: IndexState): Promise<void>;
  delete(key: string): Promise<void>;
}
```

### 6. `src/tools/types.ts`

Tool context and interface for client tools:

```typescript
import type { DirectContext } from "@augmentcode/auggie-sdk";
import type { Source } from "../sources/types.js";
import type { IndexState } from "../core/types.js";

/** Context passed to tool implementations */
interface ToolContext {
  context: DirectContext;     // For search operations
  source: Source | null;      // Optional - null if search-only client
  state: IndexState;          // For metadata access
}

/** Search options */
interface SearchOptions {
  maxOutputLength?: number;
}
```

Note: `FileInfo` is defined in `src/core/types.ts` (see above), not here.

### 7. `src/core/file-filter.ts`

Copy from `examples/typescript-sdk/context/github-action-indexer/src/file-filter.ts` and adapt:
- Keep all existing functions: `alwaysIgnorePath`, `isKeyishPath`, `isValidFileSize`, `isValidUtf8`, `shouldFilterFile`
- Keep the `DEFAULT_MAX_FILE_SIZE` constant
- Keep the `KEYISH_PATTERN` regex
- Ensure exports work with ESM

### 8. `src/core/utils.ts`

Shared utility functions:
- `sanitizeKey(key: string): string` - sanitize index key for use in filenames/paths
- Any other shared helpers identified during implementation

## Acceptance Criteria

- [ ] `npm install` succeeds
- [ ] `npm run build` compiles without errors
- [ ] All type files export their interfaces/types
- [ ] `file-filter.ts` works identically to the original
- [ ] No circular dependencies between modules

## Testing

Create `src/core/file-filter.test.ts` with tests for:
- `shouldFilterFile` correctly filters binary files
- `shouldFilterFile` correctly filters files with `..` in path
- `shouldFilterFile` correctly filters keyish files (`.pem`, `.key`, etc.)
- `shouldFilterFile` correctly filters oversized files
- `shouldFilterFile` allows valid text files

Run with: `npm test`

## Notes

- All imports must use `.js` extension for ESM compatibility
- Export all types from a barrel file at each level (`src/core/index.ts`, etc.)
- Use `type` imports where possible for better tree-shaking
- Follow existing code style from the reference implementation

