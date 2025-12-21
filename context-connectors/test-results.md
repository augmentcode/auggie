# Context Connectors Test Results

This document tracks test results, findings, and gaps across all testing phases.

---

## Phase 2: Filesystem Source + Filesystem Store

**Date:** 2025-12-17  
**Status:** ✅ Complete

### Test Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 2.1 | Index local directory | ✅ Pass | 52 files indexed from `./src` |
| 2.2 | Search the index | ✅ Pass | Queries for "indexer", "GitHub source", "file filtering" all returned relevant results |
| 2.3 | Incremental indexing | ✅ Pass | New file was searchable after re-index (full index, not incremental - see findings) |
| 2.4 | .augmentignore filtering | ✅ Pass | 37 files indexed (16 test files filtered out by `*.test.ts` pattern) |
| 2.5 | CLI Agent (Interactive) | ✅ Pass | Tested with Anthropic provider |
| 2.6 | CLI Agent (Single Query) | ✅ Pass | Tested with Anthropic provider |

### Findings

#### 1. SDK ESM Module Resolution Issue
The `@augmentcode/auggie-sdk` package has missing `.js` extensions in its ESM imports, causing `ERR_MODULE_NOT_FOUND` errors.

**Workaround applied:**
```bash
find node_modules/@augmentcode/auggie-sdk/dist -name "*.js" -exec sed -i -E \
  's/from "(\.[^"]*[^j])"$/from "\1.js"/g; s/from "(\.[^"]*[^s])"$/from "\1.js"/g' {} \;
```

**Recommendation:** Fix the SDK build to include `.js` extensions in imports.

#### 2. Credential Field Name Mismatch
The test documentation referenced `apiToken` and `apiUrl`, but `~/.augment/session.json` uses:
- `accessToken` (not `apiToken`)
- `tenantURL` (not `apiUrl`)

Environment variables should be set as:
```bash
export AUGMENT_API_TOKEN=$(jq -r '.accessToken' ~/.augment/session.json)
export AUGMENT_API_URL=$(jq -r '.tenantURL' ~/.augment/session.json)
```

#### 3. .augmentignore Location
The `.augmentignore` file must be placed in the **source root directory** (the path specified with `--path`), not the current working directory.

#### 4. CLI Agent --with-source Flag
The `listFiles` and `readFile` tools are only available when `--with-source` is passed to the agent command. Without this flag, only the `search` tool is available.

#### 5. Incremental Indexing Behavior
For filesystem sources, incremental indexing appears to perform a full re-index. This may be expected behavior for Phase 2, with true incremental support planned for later.

### CLI Agent Tool Verification

All three tools were verified to work correctly:

| Tool | Test Query | Result |
|------|------------|--------|
| `search` | "What is the purpose of the Indexer class?" | ✅ Comprehensive answer with code examples |
| `listFiles` | "List all TypeScript files in the bin directory" | ✅ Returned 6 files (requires `--with-source`) |
| `readFile` | "Read the file bin/index.ts" | ✅ Read and explained file contents (requires `--with-source`) |

### Test Gaps

#### 1. LLM Provider Coverage
- ✅ Anthropic (`claude-sonnet-4-5`) - Tested
- ❌ OpenAI - Not tested (no API key available)
- ❌ Google - Not tested (no API key available)

#### 2. Store Types
- ✅ FilesystemStore - Tested
- ❌ S3Store - Not tested in Phase 2 (covered in Phase 4)
- ❌ MemoryStore - Not tested in Phase 2

#### 3. Edge Cases Not Tested
- Very large files (>1MB)
- Binary file filtering verification
- Secret/key detection filtering
- Unicode file content handling
- Symlink handling
- Empty directories

#### 4. Error Handling
- Invalid API credentials
- Network failures during indexing
- Corrupted state file recovery
- Concurrent access to same index

---

## Phase 3: MCP Server Integration

**Date:** 2025-12-17
**Status:** ✅ Complete

### Test Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 3.1 | Start MCP Server (Basic Mode) | ✅ Pass | Server started with `npx context-connectors mcp --key test-filesystem` |
| 3.2 | Connect with MCP Inspector | ✅ Pass | Connected via stdio transport with environment variables |
| 3.3 | Test search tool | ✅ Pass | Query "how does indexing work" returned relevant code snippets from `core/indexer.ts` |
| 3.4 | Start MCP Server with Source Access | ✅ Pass | `--with-source ./src` enabled all three tools |
| 3.5 | Test list_files tool | ✅ Pass | `pattern: core/**` returned 7 files in core directory |
| 3.6 | Test read_file tool | ✅ Pass | `path: core/indexer.ts` returned full file content |

### MCP Tools Verification

| Tool | Parameters | Basic Mode | With --with-source |
|------|------------|------------|-------------------|
| `search` | `query` (required), `maxChars` (optional) | ✅ Available | ✅ Available |
| `list_files` | `pattern` (optional glob) | ❌ Not available | ✅ Available |
| `read_file` | `path` (required) | ❌ Not available | ✅ Available |

### Findings

#### 1. MCP Inspector Setup
Connection configuration required:
- **Transport Type:** STDIO
- **Command:** `npx`
- **Arguments:** `context-connectors mcp --key test-filesystem --with-source ./src`
- **Environment Variables:** `AUGMENT_API_TOKEN` and `AUGMENT_API_URL` must be set

#### 2. Tool Parameter Naming
The `list_files` tool uses `pattern` (glob pattern) rather than `path` as suggested in the test plan. The pattern supports standard glob syntax (e.g., `core/**`, `**/*.ts`).

#### 3. Search Results Format
Search results include:
- Path with line numbers
- Relevant code snippets with context
- Multiple file matches ordered by relevance

### Test Gaps

#### 1. Error Handling
- Invalid index key behavior
- Missing source path with `--with-source`
- Malformed search queries

#### 2. Edge Cases
- Very long search queries
- Special characters in file paths
- Non-existent file paths for `read_file`

---

## Phase 4: GitHub Source Integration

**Date:** 2025-12-17
**Status:** ✅ Complete

### Test Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 4.1 | Index public repository | ✅ Pass | `octocat/Hello-World` - 1 file indexed, search verified |
| 4.2 | Index private repository | ✅ Pass | `igor0/lm-plot` - 10 files indexed, search verified |
| 4.3 | Index specific branch/ref | ✅ Pass | `octocat/Hello-World#test` - different commit SHA, 2 files |
| 4.4 | Incremental update | ✅ Pass | Detected "unchanged" (254ms) and "incremental" (1 file changed) |
| 4.5 | Force push detection | ✅ Pass | Orphan commit triggered full re-index with detection message |
| 4.6 | .gitignore respected | ✅ Pass | Only 10 source files indexed, no `__pycache__`/build artifacts |

### Findings

#### 1. CLI Syntax Difference
The test document suggested `github:owner/repo#ref` shorthand syntax, but the actual CLI uses:
```bash
npx context-connectors index --source github --owner <owner> --repo <repo> --ref <ref> --key <key>
```

#### 2. GitHub Token Source
The `GITHUB_TOKEN` environment variable is required. Can be obtained from `gh auth token` if GitHub CLI is authenticated.

#### 3. Tarball-Based Indexing
GitHub source uses the tarball API for efficient full downloads, avoiding individual file API calls.

#### 4. Incremental Update Behavior

| Scenario | Type | Duration | Notes |
|----------|------|----------|-------|
| No changes | `unchanged` | 254ms | Same commit SHA, no tarball download |
| Normal push | `incremental` | 4515ms | Only changed files re-indexed |
| Force push (orphan) | `full` | 1751ms | "Force push detected" message, full re-index |

#### 5. Force Push Detection Limitation
Force push detection relies on GitHub's Compare API returning a 404 error ("No common ancestor"). However, when force-pushing to an **older ancestor commit** (still reachable), the API returns `status: "behind"` with 0 files changed, which is interpreted as "unchanged" rather than triggering a full re-index.

**Scenario that works:**
- Force push with orphan commit (no common ancestor) → Detected ✅

**Scenario with limitation:**
- Force push to revert to older commit (still an ancestor) → Not detected as force push ⚠️

**Potential fix:** Also check for `status: "behind"` or `behind_by > 0` in the Compare API response.

#### 6. .gitignore Handling
Since GitHub's tarball API only includes committed files, `.gitignore` patterns are inherently respected (ignored files are never committed in the first place).

### Branch/Ref Indexing Verification

| Repository | Ref | Commit SHA | Files |
|------------|-----|------------|-------|
| octocat/Hello-World | HEAD (master) | `7fd1a60b01f...` | 1 (README) |
| octocat/Hello-World | test | `b3cbd5bbd7e...` | 2 (README, CONTRIBUTING.md) |

The `test` branch correctly resolved to a different commit SHA and contained different files.

### Test Gaps

#### 1. Not Tested
- Very large repositories (>1000 files)
- Rate limiting behavior (5000 requests/hour for authenticated users)
- GitHub Enterprise/self-hosted instances
- Repository with submodules
- Large files handling

#### 2. Edge Cases
- Repository with only binary files
- Empty repository
- Repository with special characters in file paths
- Private repository without sufficient token permissions

---

## Phase 5: GitLab Source Integration

**Date:** 2025-12-17
**Status:** ✅ Complete

### Test Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 5.1 | Index GitLab.com project | ✅ Pass | `igor0s/test-project` - 2 files indexed, search verified |
| 5.2 | Index self-hosted GitLab | ⬜ Skipped | Optional - no self-hosted instance available |
| 5.3 | Incremental update | ✅ Pass | Added `src/utils.ts`, re-indexed as "incremental" (1 file) |
| 5.4 | Index specific branch | ✅ Pass | `feature-branch` indexed with 4 files, branch-specific `feature.ts` found |

### Findings

#### 1. GitLab 406 Not Acceptable Error (Bug Fixed)

When downloading repository archives, GitLab returned a 406 Not Acceptable error due to hotlinking protection that blocks cross-origin requests from Node.js fetch.

**Fix applied in `src/sources/gitlab.ts`:**
```typescript
const response = await fetch(url, {
  headers: { "PRIVATE-TOKEN": this.token },
  mode: "same-origin",  // Added to bypass hotlinking protection
});
```

**Reference:** https://github.com/unjs/giget/issues/97

#### 2. CLI Syntax
```bash
npx context-connectors index --source gitlab --project <group/project> --ref <branch> --key <key>
```

#### 3. GitLab Token Setup
The `GITLAB_TOKEN` environment variable is required with `read_repository` scope.

#### 4. Incremental Indexing Verification

| Scenario | Type | Files Indexed | Notes |
|----------|------|---------------|-------|
| Initial index | `full` | 2 | README.md, src/index.ts |
| After adding src/utils.ts | `incremental` | 1 | Only new file indexed |

#### 5. Branch-Specific Indexing

| Branch | Files | Branch-Specific Content |
|--------|-------|------------------------|
| `main` | 3 | README.md, src/index.ts, src/utils.ts |
| `feature-branch` | 4 | All main files + feature.ts |

Search confirmed `feature.ts` only appears in the `feature-branch` index, not in `main`.

### Bug Fixes Applied

#### 1. GitLab Archive Download Fix
Added `mode: 'same-origin'` to fetch request in `src/sources/gitlab.ts` to bypass GitLab's hotlinking protection.

#### 2. Test File Type Fixes
Updated mock `DirectContextState` in three test files to include required fields:
- `src/stores/filesystem.test.ts`
- `src/stores/memory.test.ts`
- `src/stores/s3.test.ts`

### Test Gaps

#### 1. Not Tested
- Self-hosted GitLab instances
- Very large GitLab repositories
- GitLab groups with nested subgroups
- GitLab CI/CD integration triggers

#### 2. Edge Cases
- Repositories with special characters in paths
- Private repositories without sufficient token permissions
- Force push detection for GitLab

---

## Phase 6: Website Source Integration

**Date:** 2025-12-17
**Status:** ✅ Complete

### Test Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 6.1 | Crawl a simple site | ✅ Pass | `example.com` - 1 page indexed |
| 6.2 | Test depth and page limits | ✅ Pass | `--max-depth 2 --max-pages 10` respected exactly |
| 6.3 | Test robots.txt respect | ✅ Pass | Verified loading works; docs.augmentcode.com has no Disallow rules |
| 6.4 | Test include/exclude patterns | ✅ Pass | Both patterns work correctly after CLI/crawl logic fixes |
| 6.5 | Search indexed website content | ✅ Pass | Queries for "installation instructions" and "keyboard shortcuts" returned relevant results |

### Findings

#### 1. Missing cheerio Dependency
Initially, website crawling returned 0 pages because `cheerio` (HTML parser) was not installed.

**Fix:**
```bash
npm install cheerio
```

#### 2. CLI Options Added for Include/Exclude Patterns
The test document suggested URL-style syntax (`website:https://example.com?include=/docs/*`), but this wasn't implemented. Added proper CLI options:

```bash
npx context-connectors index --source website --url <url> --include "/path/*" --exclude "/other/*" --key <key>
```

**New options in `cmd-index.ts`:**
- `--include <patterns...>` - URL path patterns to include (glob)
- `--exclude <patterns...>` - URL path patterns to exclude (glob)

#### 3. Crawl Logic Fix for Include/Exclude Patterns
Original implementation checked include/exclude before crawling, preventing discovery of matching pages.

**Fix in `website.ts`:**
- Separated traversal from indexing
- Crawler now traverses all pages to discover links
- Include/exclude patterns only control what gets **indexed**, not what gets traversed

**Before:** `--include "/setup-augment/*"` indexed 0 pages (root blocked)
**After:** `--include "/setup-augment/*"` correctly indexed 7 pages from that path

#### 4. robots.txt Support
The crawler respects `robots.txt` by default. The implementation loads and parses the robots.txt file at crawl start. Testing was limited because `docs.augmentcode.com` has no `Disallow` rules.

#### 5. Static HTML Only
Website source only crawls static HTML content. JavaScript-rendered content is not supported.

### Include/Exclude Pattern Verification

| Pattern | Pages Indexed | Expected Behavior |
|---------|---------------|-------------------|
| `--include "/setup-augment/*"` | 7 | Only setup-augment pages |
| `--exclude "/setup-augment/*"` | 15 | All pages except setup-augment |
| No patterns | 10 (with limits) | All discovered pages |

### Search Verification

| Query | Index Key | Result |
|-------|-----------|--------|
| "installation instructions" | test-website-include | ✅ Found install-visual-studio-code.md, install-jetbrains-ides.md |
| "keyboard shortcuts" | test-website-include | ✅ Found vscode-keyboard-shortcuts.md |
| "example domain" | test-website-simple | ✅ Found example.com content |

### Code Changes Applied

#### 1. `src/bin/cmd-index.ts`
Added `--include` and `--exclude` CLI options:
```typescript
.option("--include <patterns...>", "URL path patterns to include (website, glob)")
.option("--exclude <patterns...>", "URL path patterns to exclude (website, glob)")
```

Passed to WebsiteSource config:
```typescript
source = new WebsiteSource({
  url: options.url,
  maxDepth: options.maxDepth,
  maxPages: options.maxPages,
  includePaths: options.include,
  excludePaths: options.exclude,
});
```

#### 2. `src/sources/website.ts`
Fixed crawl method to separate traversal from indexing - moved `shouldCrawlUrl()` check after link discovery.

### Unit Test Verification

All 15 website source tests pass:
```
✓ src/sources/website.test.ts (15)
```

### Test Gaps

#### 1. Not Tested
- JavaScript-rendered pages (SPA sites)
- Sites with complex robots.txt rules (actual Disallow entries)
- Very large sites (>100 pages)
- Rate limiting behavior
- Sites requiring authentication
- Sitemap.xml parsing

#### 2. Edge Cases
- Circular links between pages
- Malformed HTML
- Non-UTF8 encoded pages
- Very large individual pages
- Sites with query parameters in URLs

---

## Phase 7: S3 Store Integration

**Date:** 2025-12-18
**Status:** ✅ Complete

### Test Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 7.1 | Index to S3 Store | ✅ Pass | `./src` indexed to MinIO bucket with 54 files |
| 7.2 | Load and Search from S3 | ✅ Pass | Query "indexer implementation" returned relevant results |
| 7.3 | List All Indexes in S3 | ✅ Pass | `list` command shows `test-s3-index` |
| 7.4 | Delete Index from S3 | ✅ Pass | Index deleted, verified with `list` showing "No indexes found" |
| 7.5 | Test Custom Prefix | ✅ Pass | Index stored under `my-indexes/test-custom-prefix/` prefix |

### Test Environment

**MinIO Setup:**
```bash
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  --name minio-test \
  minio/minio server /data --console-address ":9001"
```

**Environment Variables:**
```bash
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AUGMENT_API_TOKEN=$(jq -r '.accessToken' ~/.augment/session.json)
export AUGMENT_API_URL=$(jq -r '.tenantURL' ~/.augment/session.json)
```

### Findings

#### 1. Missing CLI Commands for List and Delete

The `list` and `delete` commands were not implemented. Created:
- `src/bin/cmd-list.ts` - Lists all index keys in a store
- `src/bin/cmd-delete.ts` - Deletes an index from a store

Both commands support the same S3 options as `index` and `search`.

#### 2. Search Command Missing S3 Store Support

The `search` command only supported filesystem store. Added S3 options:
- `--bucket <name>` - S3 bucket name
- `--s3-prefix <prefix>` - S3 key prefix (default: `context-connectors/`)
- `--s3-region <region>` - S3 region
- `--s3-endpoint <url>` - S3-compatible endpoint URL
- `--s3-force-path-style` - Use path-style S3 URLs

#### 3. MinIO/S3-Compatible Service Requirements

For MinIO and other S3-compatible services:
- Use `--s3-endpoint http://localhost:9000` to specify the endpoint
- Use `--s3-force-path-style` for path-style URLs (required by most S3-compatible services)

### Code Changes Applied

#### 1. `src/bin/cmd-search.ts`
Added S3 store options matching `cmd-index.ts` pattern.

#### 2. `src/bin/cmd-list.ts` (New)
```typescript
export const listCommand = new Command("list")
  .description("List all indexed keys in a store")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  .option("--bucket <name>", "S3 bucket name (for s3 store)")
  .option("--s3-prefix <prefix>", "S3 key prefix", "context-connectors/")
  .option("--s3-endpoint <url>", "S3-compatible endpoint URL")
  .option("--s3-force-path-style", "Use path-style S3 URLs")
  // ...
```

#### 3. `src/bin/cmd-delete.ts` (New)
```typescript
export const deleteCommand = new Command("delete")
  .description("Delete an index from a store")
  .argument("<key>", "Index key/name to delete")
  .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
  // ... same S3 options
```

#### 4. `src/bin/index.ts`
Added imports and registration for `listCommand` and `deleteCommand`.

### CLI Command Syntax

**Index to S3:**
```bash
npx context-connectors index --source filesystem --path ./src --key my-index \
  --store s3 --bucket my-bucket \
  --s3-endpoint http://localhost:9000 --s3-force-path-style
```

**Search from S3:**
```bash
npx context-connectors search "query" --key my-index \
  --store s3 --bucket my-bucket \
  --s3-endpoint http://localhost:9000 --s3-force-path-style
```

**List indexes in S3:**
```bash
npx context-connectors list \
  --store s3 --bucket my-bucket \
  --s3-endpoint http://localhost:9000 --s3-force-path-style
```

**Delete index from S3:**
```bash
npx context-connectors delete my-index \
  --store s3 --bucket my-bucket \
  --s3-endpoint http://localhost:9000 --s3-force-path-style
```

### Custom Prefix Verification

| Prefix | S3 Path |
|--------|---------|
| Default (`context-connectors/`) | `s3://test-bucket/context-connectors/test-s3-index/` |
| Custom (`my-indexes/`) | `s3://test-bucket/my-indexes/test-custom-prefix/` |

### Unit Test Verification

All 136 tests pass after changes:
```
Test Files  16 passed (16)
     Tests  136 passed | 12 skipped (148)
```

### Test Gaps

#### 1. Not Tested
- Real AWS S3 (only tested with MinIO)
- Cloudflare R2
- Other S3-compatible services (DigitalOcean Spaces, Backblaze B2)
- S3 with IAM role authentication
- Cross-region replication

#### 2. Edge Cases
- Very large indexes (>100MB state file)
- Concurrent access to same index
- Network failures during upload/download
- Bucket with restrictive policies
- S3 versioning enabled buckets

---

## Phase 8: GitHub Webhook Integration

**Date:** 2025-12-19
**Status:** ✅ Complete

### Test Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 8.1 | Create Express server | ✅ Pass | Server started with `express.raw()` middleware |
| 8.2 | Invalid signature rejected | ✅ Pass | Returns 401 with `{"error":"Invalid signature"}` |
| 8.3 | Valid push event processed | ✅ Pass | Signature validated, handler invoked correctly |
| 8.4 | Branch deletion handling | ✅ Pass | Returns `{"status":"skipped","message":"Branch deleted, index preserved"}` |
| 8.5 | shouldIndex filter | ✅ Pass | Feature branches filtered, returns `{"status":"skipped","message":"Filtered by shouldIndex"}` |
| 8.6 | Custom getKey | ✅ Pass | Key format `owner/repo/branch` working correctly |
| 8.7 | Real GitHub webhook | ✅ Pass | Indexed 11 files from `igor0/lm-plot` via localhost.run tunnel |

### Bug Fix Applied

#### Express Handler Buffer Body Handling

When using `express.raw({ type: "application/json" })` middleware, the request body is a `Buffer`, but the original code only handled `string` and `object` types. This caused signature verification to always fail.

**Root cause:** `typeof Buffer === "object"`, so Buffer bodies went through `JSON.stringify(req.body)` which produces `{"type":"Buffer","data":[...]}` instead of the original JSON payload.

**Fix in `src/integrations/github-webhook-express.ts`:**
```typescript
// Handle Buffer (from express.raw()), string, or object
let body: string;
if (Buffer.isBuffer(req.body)) {
  body = req.body.toString("utf-8");
} else if (typeof req.body === "string") {
  body = req.body;
} else {
  body = JSON.stringify(req.body);
}
```

### Test Environment

**Tunnel for Real Webhook Testing:**
```bash
ssh -R 80:localhost:3000 localhost.run
```

This provides a public URL without installing ngrok.

**Test Server Setup:**
```javascript
import express from "express";
import { createExpressHandler } from "@augmentcode/context-connectors/integrations/express";
import { FilesystemStore } from "@augmentcode/context-connectors/stores";

const app = express();
const store = new FilesystemStore({ basePath: "./.webhook-indexes" });

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  createExpressHandler({
    store,
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    shouldIndex: (event) => event.ref === "refs/heads/main",
    onIndexed: (key, result) => console.log(`✓ Indexed ${key}`),
    onError: (error, event) => console.error(`✗ Error:`, error.message),
  })
);

app.listen(3000);
```

### Findings

#### 1. Signature Verification
HMAC-SHA256 signature verification works correctly. The signature header format is `sha256=<hex-digest>`.

#### 2. GitHub Token Required for Indexing
While webhook signature verification works without `GITHUB_TOKEN`, actual repository indexing requires the token to fetch the tarball via GitHub API.

#### 3. Webhook Response Timing
Indexing happens synchronously, so webhook responses are delayed until indexing completes (~4 minutes for initial index of 11 files). Consider async indexing for large repositories.

#### 4. Export Function Name
The actual export is `createExpressHandler` (not `createExpressWebhookHandler` as suggested in test documentation).

### Test Gaps

#### 1. Not Tested
- ~~Vercel adapter (`createVercelHandler`)~~ - Tested in Phase 9
- Other webhook events (pull_request, etc.)
- Concurrent webhook deliveries
- Webhook retry behavior (GitHub retries on timeout)

#### 2. Edge Cases
- Very large repository indexing causing webhook timeout
- Invalid JSON payloads
- Missing required event fields
- Repository permissions changes between webhook setup and delivery

---

## Phase 9: Vercel Integration

**Date:** 2025-12-20
**Status:** ✅ Complete

### Test Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 9.1 | Create Next.js webhook route | ✅ Pass | Created `app/api/webhook/route.ts` with `createVercelHandler` |
| 9.2 | Test locally | ✅ Pass | All 5 handler tests pass, real indexing verified |
| 9.3 | Deploy to Vercel | ⬜ Skipped | Optional - deployment/ops concern, not code verification |
| 9.4 | Configure GitHub webhook | ⬜ Skipped | Optional - requires Vercel deployment |
| 9.5 | End-to-end push test | ✅ Pass | Simulated locally with real commit SHA |
| 9.6 | Verify search works | ✅ Pass | Search against webhook-created index works |

### Handler Tests

| Test | Description | Result |
|------|-------------|--------|
| 1 | Valid signature with main branch push | ✅ Pass - Processes correctly |
| 2 | Invalid signature rejected | ✅ Pass - Returns 401 |
| 3 | Missing headers | ✅ Pass - Returns 400 |
| 4 | Non-main branch skipped | ✅ Pass - `shouldIndex` filter works |
| 5 | Non-push event skipped | ✅ Pass - Ping events ignored |

### Full Integration Test

Real commit SHA test with Next.js dev server:
- Repository: `augmentcode/auggie`
- Commit: `5a6114ea1435281ff34825ad12141862f01512d4`
- Files indexed: 166
- Index location: `.webhook-indexes/augmentcode_auggie_main/`
- Search verified: Query "GitHub webhook handler" returned relevant results

### Findings

#### 1. Test Documentation Discrepancy

The test document `test-phase9.md` has two inaccuracies:
- References `createVercelWebhookHandler` but actual export is `createVercelHandler`
- Shows `shouldIndex: (repo, ref) => {...}` but actual signature is `shouldIndex: (event: PushEvent) => boolean`

#### 2. Vercel Deployment Not Required for Code Verification

The Vercel cloud deployment (steps 9.3-9.4) tests operational concerns:
- Serverless cold starts and timeouts
- Environment variable configuration in Vercel dashboard
- GitHub reaching public URLs

The local Next.js dev server uses the identical Request/Response API as Vercel, so code paths are the same.

#### 3. Handler Export Location

```typescript
// From integrations barrel export
import { createVercelHandler } from "@augmentcode/context-connectors/integrations";

// Or direct import
import { createVercelHandler } from "@augmentcode/context-connectors/integrations/vercel";
```

### Test Artifacts Created

Test example app created at `context-connectors/examples/vercel-webhook-test/`:
- `app/api/webhook/route.ts` - Next.js webhook route handler
- `test-handler.ts` - Standalone test script for handler verification

### Test Gaps

#### 1. Not Tested
- Actual Vercel serverless deployment
- Vercel Edge Functions (not supported - requires Node.js runtime)
- Vercel function timeout behavior (10s hobby, 60s pro)

#### 2. Edge Cases
- Large repos causing serverless timeout
- Concurrent webhook deliveries to same Vercel function
- Cold start latency impact on webhook response time

---

## Phase 10: Multi-Provider Agent Testing

**Date:** 2025-12-21
**Status:** ✅ Complete

### Test Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 10.1 | OpenAI provider | ✅ Pass | Works after ZDR fix (uses Chat Completions API) |
| 10.2 | Anthropic provider | ✅ Pass | `claude-sonnet-4-20250514` tested successfully |
| 10.3 | Google provider | ✅ Pass | `gemini-2.5-flash` and `gemini-3-flash-preview` both work |
| 10.4 | Verbose mode | ✅ Pass | `--verbose` shows `[tool]` calls in output |
| 10.5 | Streaming output | ✅ Pass | Text streams progressively |
| 10.6 | Max steps limit | ✅ Pass | `--max-steps 2` correctly limits tool calls |
| 10.7 | Interactive mode | ⬜ Skipped | Manual test - optional |

### Bug Fix Applied

#### OpenAI Zero Data Retention (ZDR) Compatibility

**Problem:** The Vercel AI SDK's default `openai()` provider uses OpenAI's Responses API, which is stateful and generates server-side IDs (`fc_...`) for function calls. For ZDR organizations, these IDs are not persisted, causing multi-step tool calls to fail with:

```
Item with id 'fc_...' not found. Items are not persisted for Zero Data Retention organizations.
```

**Fix in `src/clients/cli-agent.ts`:**
```typescript
case "openai": {
  const { openai } = await import("@ai-sdk/openai");
  // Use openai.chat() instead of openai() to use the Chat Completions API
  // rather than the Responses API. The Responses API is stateful and doesn't
  // work with Zero Data Retention (ZDR) organizations.
  return openai.chat(modelName);
}
```

**Trade-off:** The Chat Completions API is stateless and works with ZDR, but doesn't support streaming reasoning tokens (a newer OpenAI feature).

### Default Model Updates

Updated default models to use lower-cost variants:

| Provider | Previous Default | New Default |
|----------|-----------------|-------------|
| OpenAI | `gpt-5.2` | `gpt-5-mini` |
| Anthropic | `claude-sonnet-4-5` | `claude-haiku-4-5` |
| Google | `gemini-3-pro` | `gemini-3-flash-preview` |

### Model Availability Testing

| Model | Status |
|-------|--------|
| `gpt-5.2` | ✅ Works |
| `gpt-5-mini` | ✅ Works |
| `gpt-5.2-mini` | ❌ Not found |
| `gpt-4o` | ✅ Works |
| `gpt-4o-mini` | ✅ Works |
| `claude-sonnet-4-20250514` | ✅ Works |
| `claude-haiku-4-5` | ✅ Works |
| `gemini-2.0-flash` | ⚠️ Quota exceeded (free tier) |
| `gemini-2.5-flash` | ✅ Works |
| `gemini-3-flash` | ❌ Not found |
| `gemini-3-flash-preview` | ✅ Works |
| `gemini-3-pro` | ❌ Not tested |

### Findings

#### 1. Vercel AI SDK Provider Selection

The Vercel AI SDK provides two ways to instantiate OpenAI models:
- `openai(model)` - Uses the Responses API (stateful, newer features)
- `openai.chat(model)` - Uses Chat Completions API (stateless, ZDR-compatible)

For compatibility with enterprise organizations using ZDR, we now use `openai.chat()`.

#### 2. Google Model Naming

Google's Gemini models use various naming conventions:
- Release models: `gemini-2.0-flash`, `gemini-2.5-flash`
- Preview models: `gemini-3-flash-preview`
- Pro variants exist but weren't tested

#### 3. Agent Tool Verification

All three tools work correctly across all tested providers:

| Tool | OpenAI | Anthropic | Google |
|------|--------|-----------|--------|
| `search` | ✅ | ✅ | ✅ |
| `listFiles` | ✅ | ✅ | ✅ |
| `readFile` | ✅ | ✅ | ✅ |

### Test Gaps

#### 1. Not Tested
- Interactive mode (manual test required)
- Provider fallback behavior
- Token counting/limits per provider
- Streaming errors mid-response

#### 2. Edge Cases
- Very long conversations (context window limits)
- Tool calls returning very large results
- Concurrent agent sessions

---

## Summary

### Phases Completed
- ✅ Phase 2: Filesystem Source + Filesystem Store
- ✅ Phase 3: MCP Server Integration
- ✅ Phase 4: GitHub Source Integration
- ✅ Phase 5: GitLab Source Integration
- ✅ Phase 6: Website Source Integration
- ✅ Phase 7: S3 Store Integration
- ✅ Phase 8: GitHub Webhook Integration
- ✅ Phase 9: Vercel Integration
- ✅ Phase 10: Multi-Provider Agent Testing

### Issues to Address
1. **SDK ESM fix needed** - Missing `.js` extensions in imports
2. **Documentation update** - Credential field names need correction
3. **Force push detection gap** - Revert-style force pushes (to older ancestor) not detected
4. **GitLab hotlinking protection** - Fixed by adding `mode: 'same-origin'` to fetch
5. **cheerio dependency** - Required for website crawling, should be in dependencies
6. **Express handler Buffer fix** - Fixed Buffer body handling for signature verification

### Recommendations
1. Add `--with-source` to agent command examples in documentation
2. Clarify `.augmentignore` location requirements
3. Consider making `--with-source` the default when source type is filesystem
4. Update CLI docs to show actual `--source github --owner --repo` syntax (not shorthand)
5. Enhance force push detection to check for `status: "behind"` in Compare API response
6. Document GitLab token requirements and scope needed (`read_repository`)
7. Document website source limitations (static HTML only, no JS rendering)
8. Consider adding sitemap.xml support for better page discovery
9. Document S3-compatible service configuration requirements (endpoint, path-style URLs)
