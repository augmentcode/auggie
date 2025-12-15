# Phase 5: Additional Stores

## Overview

This phase adds cloud/remote storage backends beyond the FilesystemStore implemented in Phase 2. Before implementing, we need to evaluate which storage backends provide the most value.

**Depends on**: Phase 4 complete

## Requirements Discussion (Complete First)

Before implementing, analyze and document your recommendations for the following questions:

### 1. Target Use Cases

Who will use these stores and how?

- **CI/CD pipelines** (GitHub Actions, GitLab CI) - need fast, ephemeral storage
- **Self-hosted servers** - need persistent, shared storage  
- **Serverless functions** - need stateless, remote storage
- **Local development** - FilesystemStore already covers this

### 2. Evaluate S3 as a Store

Consider:
- Pros: Ubiquitous, works with many S3-compatible services (MinIO, R2, DigitalOcean Spaces)
- Cons: Requires AWS credentials, not ideal for ephemeral CI use
- Questions:
  - Is S3 the right abstraction, or should we support a broader "object storage" interface?
  - What about Cloudflare R2 (S3-compatible, no egress fees)?
  - Should we support presigned URLs for sharing indexes?

### 3. Evaluate Redis as a Store

Consider:
- Pros: Fast, good for caching, supports TTL
- Cons: Memory-limited, data not persistent by default, requires running Redis server
- Questions:
  - Is Redis appropriate for storing potentially large index states?
  - Would developers actually run Redis for this use case?
  - Is Upstash (serverless Redis) a better target than self-hosted Redis?

### 4. Alternative Storage Backends

Evaluate these alternatives and recommend which (if any) should be prioritized:

| Backend | Pros | Cons | Use Case |
|---------|------|------|----------|
| **GitHub Actions Cache** | Free, integrated with GHA, fast | GHA-only, 10GB limit, 7-day retention | CI/CD |
| **GitHub Actions Artifacts** | Already used in Phase 4 workflow | Slower, meant for outputs not caching | CI/CD outputs |
| **SQLite** | Single file, no server, portable | Need to handle file locking | Local/shared |
| **PostgreSQL** | Robust, common in deployments | Heavier setup, overkill? | Server deployments |
| **Cloudflare KV** | Edge-friendly, serverless | Cloudflare-specific | Edge/serverless |
| **Vercel KV** | Vercel-native, Redis-compatible | Vercel-specific | Vercel deployments |
| **Supabase Storage** | Easy setup, has free tier | Another dependency | Quick prototypes |

### 5. Developer Experience

What's the path of least resistance for developers?

- What storage is already available in their environment?
- What requires the least configuration?
- What has the best free tier for experimentation?

### 6. Recommendation Format

After analysis, provide a recommendation in this format:

```markdown
## Recommended Stores

### Priority 1: [Store Name]
- **Why**: [Reasoning]
- **Target users**: [Who benefits]
- **Implementation complexity**: Low/Medium/High

### Priority 2: [Store Name]
- **Why**: [Reasoning]
- **Target users**: [Who benefits]  
- **Implementation complexity**: Low/Medium/High

### Defer/Skip: [Store Names]
- **Why**: [Reasoning]
```

---

## Implementation (After Discussion)

Once stores are selected, implement each following this pattern:

### Store Implementation Template

```typescript
// src/stores/{name}.ts

export interface {Name}StoreConfig {
  // Store-specific configuration
}

export class {Name}Store implements IndexStore {
  constructor(config: {Name}StoreConfig) { }
  
  async load(key: string): Promise<IndexState | null> { }
  async save(key: string, state: IndexState): Promise<void> { }
  async delete(key: string): Promise<void> { }
  async list(): Promise<string[]> { }
}
```

### Update Exports

```typescript
// src/stores/index.ts
export { {Name}Store, type {Name}StoreConfig } from "./{name}.js";
```

### Update CLI

```typescript
// src/bin/cmd-index.ts - add store type option
if (options.store === "{name}") {
  const { {Name}Store } = await import("../stores/{name}.js");
  store = new {Name}Store({ /* config from options/env */ });
}
```

### Testing

- Unit tests with mocked backend
- Integration tests (skip if credentials not available)
- Test save/load round-trip
- Test list functionality
- Test delete functionality
- Test error handling (network failures, auth errors)

## Acceptance Criteria

- [ ] Requirements discussion completed and documented
- [ ] Selected stores implemented
- [ ] Each store has corresponding tests
- [ ] CLI supports new store types
- [ ] Documentation for configuring each store
- [ ] `npm run build` compiles without errors

## Notes

- Use optional peer dependencies for store-specific SDKs
- Provide helpful error messages when SDK not installed
- Consider a "store factory" function for CLI convenience
- Index state is JSON - ensure chosen stores handle JSON well
- Consider compression for large indexes (gzip before storing)

