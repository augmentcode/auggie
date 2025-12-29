# Data Store Changes

Specification for updating the filesystem store location and CLI naming conventions.

## Summary

1. **Rename `--key` to `--name`** across all CLI commands
2. **Change default store location** from CWD-relative `.context-connectors` to platform-specific home directory
3. **Add environment variable override** for store path

## 1. CLI Flag Rename

### Change

| Before | After |
|--------|-------|
| `-k, --key <name>` | `-n, --name <name>` |

### Files to Update

- `src/bin/cmd-index.ts`
- `src/bin/cmd-search.ts`
- `src/bin/cmd-agent.ts`
- `src/bin/cmd-mcp.ts`
- `src/bin/cmd-mcp-serve.ts`
- `src/bin/cmd-list.ts`
- `src/bin/cmd-delete.ts`
- `src/bin/cmd-init.ts` (workflow template uses `-k`)
- `README.md` (all examples)

### Notes

- Update option definition: `.requiredOption("-n, --name <name>", "Index name")`
- Update all references from `options.key` to `options.name`
- Update help text/descriptions to use "name" instead of "key"

## 2. Default Store Location

### Current Behavior

```typescript
const DEFAULT_BASE_PATH = ".context-connectors";
```

This creates the store relative to CWD, which is fragile (especially for MCP server).

### New Behavior

Use platform-specific default location:

| Platform | Default Path |
|----------|-------------|
| Linux | `~/.local/share/context-connectors` |
| macOS | `~/Library/Application Support/context-connectors` |
| Windows | `%LOCALAPPDATA%\context-connectors` |

### Implementation

In `src/stores/filesystem.ts`:

```typescript
import { homedir, platform } from "node:os";
import { join } from "node:path";

function getDefaultStorePath(): string {
  // Environment variable takes precedence
  if (process.env.CONTEXT_CONNECTORS_STORE_PATH) {
    return process.env.CONTEXT_CONNECTORS_STORE_PATH;
  }

  const home = homedir();
  
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "context-connectors");
    case "win32":
      return join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), "context-connectors");
    default:
      // Linux and others: follow XDG Base Directory spec
      const xdgData = process.env.XDG_DATA_HOME || join(home, ".local", "share");
      return join(xdgData, "context-connectors");
  }
}

const DEFAULT_BASE_PATH = getDefaultStorePath();
```

### Files to Update

- `src/stores/filesystem.ts` - implement `getDefaultStorePath()`
- `README.md` - update documentation about default location
- All CLI commands - update `--store-path` default value in help text

## 3. Environment Variable

### Name

`CONTEXT_CONNECTORS_STORE_PATH`

### Behavior

- If set, overrides the platform default
- CLI `--store-path` option still takes precedence over env var
- Document in README under Environment Variables section

### Priority Order

1. `--store-path` CLI option (highest)
2. `CONTEXT_CONNECTORS_STORE_PATH` environment variable
3. Platform-specific default (lowest)

## 4. README Updates

### Environment Variables Table

Add new row:

| Variable | Description | Required For |
|----------|-------------|--------------|
| `CONTEXT_CONNECTORS_STORE_PATH` | Override default store location | Optional |

### CLI Options Tables

Update all `--store-path` descriptions:

| Before | After |
|--------|-------|
| `--store-path <path>` Store base path `.context-connectors` | `--store-path <path>` Store base path (default: platform-specific, see below) |

### Add New Section

After "Environment Variables", add brief section explaining default store location:

```markdown
## Data Storage

By default, indexes are stored in a platform-specific location:

- **Linux**: `~/.local/share/context-connectors`
- **macOS**: `~/Library/Application Support/context-connectors`
- **Windows**: `%LOCALAPPDATA%\context-connectors`

Override with `--store-path` or the `CONTEXT_CONNECTORS_STORE_PATH` environment variable.
```

## 5. Tests

Update any tests that rely on the default path or `--key` flag:

- `src/stores/filesystem.test.ts` - may need updates if testing defaults
- Any integration tests using `-k` flag

## 6. Optional Enhancement

Consider adding a warning when overwriting an index that was created from a different source:

```typescript
// In indexer, before saving:
const existing = await store.load(name);
if (existing && existing.source.identifier !== newSource.identifier) {
  console.warn(`Warning: '${name}' was previously indexed from ${existing.source.identifier}. Overwriting.`);
}
```

This is low priority and can be deferred.

