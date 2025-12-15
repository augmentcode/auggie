# Phase 2.5: Design Alignment Update

## Overview

This phase updates the existing Phase 1 and Phase 2 code to align with design decisions made after those phases were completed:

1. **Source.listFiles()** - Add `listFiles()` method to Source interface for client use
2. **Optional Source in Clients** - Make Source optional in ToolContext (search-only vs full clients)
3. **FileInfo in core types** - Move FileInfo from tools/types.ts to core/types.ts

These changes ensure Clients can operate in "search-only" mode (no Source needed) or "full" mode (with Source for listFiles/readFile).

## Changes Required

### 1. Update `src/core/types.ts`

Add `FileInfo` interface (move from tools/types.ts):

```typescript
/** File info (for listFiles) */
export interface FileInfo {
  path: string;
}
```

### 2. Update `src/sources/types.ts`

Add `listFiles()` method to Source interface:

```typescript
import type { FileEntry, FileInfo, SourceMetadata } from "../core/types.js";

export interface Source {
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

### 3. Update `src/sources/filesystem.ts`

Add `listFiles()` method to FilesystemSource class.

Implementation approach: 
- Reuse the directory walking logic from `fetchAll()`
- Extract common walking logic into a private method that can either collect paths only or paths + contents
- `listFiles()` returns `FileInfo[]` (paths only), `fetchAll()` returns `FileEntry[]` (paths + contents)

```typescript
async listFiles(): Promise<FileInfo[]> {
  const { augmentignore, gitignore } = await this.loadIgnoreRules();
  const files: FileInfo[] = [];
  await this.walkDirectoryForPaths(this.rootPath, augmentignore, gitignore, files);
  return files;
}
```

**Refactoring suggestion**: Create a shared walk method with a mode parameter, or create `walkDirectoryForPaths()` that only checks path-based filters (skips reading file content). For `listFiles()`, we can apply lighter filtering since we don't need to read content.

### 4. Update `src/tools/types.ts`

Make Source optional in ToolContext:

```typescript
import type { FileInfo } from "../core/types.js";  // Import from core instead

/** Context passed to tool implementations */
export interface ToolContext {
  /** For search operations */
  context: DirectContext;
  /** For listFiles/readFile operations - null if search-only client */
  source: Source | null;
  /** For metadata access */
  state: IndexState;
}
```

Remove `FileInfo` from this file (it's now in core/types.ts).

### 5. Update `src/core/index.ts`

Export `FileInfo`:

```typescript
export type { FileInfo } from "./types.js";
```

### 6. Update `src/sources/index.ts`

Ensure `FileInfo` is re-exported if needed by source implementations.

### 7. Update tests

Update `src/sources/filesystem.test.ts` to add tests for `listFiles()`:

```typescript
describe("listFiles", () => {
  it("returns list of file paths", async () => {
    const source = new FilesystemSource({ rootPath: testDir });
    const files = await source.listFiles();
    
    expect(files).toBeInstanceOf(Array);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toHaveProperty("path");
    expect(files[0]).not.toHaveProperty("contents");
  });

  it("respects ignore rules", async () => {
    // Create a .gitignore with a pattern
    // Verify listFiles excludes those files
  });

  it("skips node_modules and .git", async () => {
    const source = new FilesystemSource({ rootPath: testDir });
    const files = await source.listFiles();
    
    const hasBadPaths = files.some(f => 
      f.path.includes("node_modules") || f.path.includes(".git")
    );
    expect(hasBadPaths).toBe(false);
  });
});
```

## Acceptance Criteria

- [ ] `FileInfo` is defined in `src/core/types.ts` and exported
- [ ] `Source` interface includes `listFiles(): Promise<FileInfo[]>`
- [ ] `FilesystemSource` implements `listFiles()`
- [ ] `ToolContext.source` is typed as `Source | null`
- [ ] `npm run build` compiles without errors
- [ ] All existing tests still pass
- [ ] New tests for `listFiles()` pass

## Implementation Notes

### listFiles() Filtering Strategy

For `listFiles()`, we have two options:

**Option A: Full filtering (same as fetchAll)**
- Walk directory, read each file, apply all filters
- Consistent with what's indexed, but slower

**Option B: Path-only filtering (faster)**
- Walk directory, apply only path-based filters
- Skip: DEFAULT_SKIP_DIRS, .gitignore patterns, .augmentignore patterns
- Don't read file content, so skip: size check, UTF-8 check, keyish content check
- Faster but may list files that wouldn't be indexed

**Recommendation**: Use Option A for consistency. The performance difference is minimal for typical repos, and consistency is more valuable.

### Error Handling for Optional Source

When `source` is null and a tool that requires it is called:
- Throw a clear error: `throw new Error("Source not configured. Cannot use listFiles/readFile in search-only mode.")`

This error handling will be implemented in Phase 3 (CLI Search Client) when the tools are built.

