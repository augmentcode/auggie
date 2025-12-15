# Phase 4: GitHub Source

## Overview

This phase implements the GitHub Source, enabling indexing of GitHub repositories. It includes tarball download for full indexing, Compare API for incremental updates, and force push detection.

**Reference Implementation**: `examples/typescript-sdk/context/github-action-indexer/src/github-client.ts`

**Depends on**: Phase 3 complete

## Goal

Support GitHub repositories as a data source with:
- Full indexing via tarball download
- Incremental updates via Compare API
- Force push detection (triggers full re-index)
- Ignore file handling (.gitignore, .augmentignore)
- GitHub Actions workflow template

## Prerequisites

- `@octokit/rest` is an optional peer dependency - must be installed to use GitHub source
- `GITHUB_TOKEN` environment variable for authentication

## Files to Create

### 1. `src/sources/github.ts`

Implements the `Source` interface for GitHub repositories.

**Configuration:**
```typescript
export interface GitHubSourceConfig {
  token?: string;           // Default: process.env.GITHUB_TOKEN
  owner: string;            // Repository owner
  repo: string;             // Repository name
  ref?: string;             // Branch/tag/commit (default: "HEAD")
}
```

**Implementation Notes:**

Reuse patterns from the reference implementation:

1. **Constructor**: Store config, create Octokit instance
2. **resolveRef()**: Resolve "HEAD" or branch names to commit SHA
3. **fetchAll()**: 
   - Download tarball using `octokit.repos.downloadTarballArchive`
   - Extract using `tar` package
   - Apply filtering (augmentignore → shouldFilterFile → gitignore)
   - Return `FileEntry[]`
4. **fetchChanges(previous)**:
   - Check if previous.ref exists and is reachable (detect force push)
   - If force push detected, return `null` (trigger full re-index)
   - Check if .gitignore/.augmentignore changed → return `null`
   - Use `octokit.repos.compareCommits` to get changed files
   - Download contents for added/modified files
   - Return `FileChanges`
5. **getMetadata()**: Return SourceMetadata with type="github", identifier="owner/repo", ref=commitSha
6. **listFiles()**: Download tarball, extract paths only (skip reading contents)
7. **readFile(path)**: Use `octokit.repos.getContent` to fetch single file

**Key Methods from Reference:**

```typescript
// Resolve ref to commit SHA
async resolveRef(owner: string, repo: string, ref: string): Promise<string>

// Download and extract tarball
async downloadTarball(owner: string, repo: string, ref: string): Promise<Map<string, string>>

// Compare commits for incremental update  
async compareCommits(owner: string, repo: string, base: string, head: string): Promise<{...}>

// Get single file contents
async getFileContents(owner: string, repo: string, path: string, ref: string): Promise<string>

// Load ignore patterns
async loadIgnorePatterns(owner: string, repo: string, ref: string): Promise<{augmentignore, gitignore}>

// Check if ignore files changed
async ignoreFilesChanged(owner: string, repo: string, base: string, head: string): Promise<boolean>

// Detect force push
async isForcePush(owner: string, repo: string, base: string, head: string): Promise<boolean>
```

### 2. Update `src/sources/index.ts`

Export GitHubSource:
```typescript
export { GitHubSource, type GitHubSourceConfig } from "./github.js";
```

### 3. Update `src/bin/cmd-index.ts`

Add GitHub source support:
```typescript
.option("--owner <owner>", "GitHub repository owner")
.option("--repo <repo>", "GitHub repository name")  
.option("--ref <ref>", "GitHub ref (branch/tag/commit)", "HEAD")

// In action:
if (options.source === "github") {
  const { GitHubSource } = await import("../sources/github.js");
  source = new GitHubSource({
    owner: options.owner,
    repo: options.repo,
    ref: options.ref,
  });
}
```

### 4. Update `src/bin/cmd-search.ts`

Add GitHub source reconstruction:
```typescript
if (state.source.type === "github") {
  const [owner, repo] = state.source.identifier.split("/");
  const { GitHubSource } = await import("../sources/github.js");
  source = new GitHubSource({
    owner,
    repo,
    ref: state.source.ref,
  });
}
```

### 5. `templates/github-workflow.yml`

GitHub Actions workflow template for automated indexing:

```yaml
name: Index Repository

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install context-connectors
        run: npm install -g @augmentcode/context-connectors
        
      - name: Restore index cache
        uses: actions/cache@v4
        with:
          path: .context-connectors
          key: index-${{ github.repository }}-${{ github.ref_name }}
          restore-keys: |
            index-${{ github.repository }}-
            
      - name: Index repository
        run: |
          context-connectors index \
            -s github \
            --owner ${{ github.repository_owner }} \
            --repo ${{ github.event.repository.name }} \
            --ref ${{ github.sha }} \
            -k ${{ github.ref_name }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          AUGMENT_API_TOKEN: ${{ secrets.AUGMENT_API_TOKEN }}
          AUGMENT_API_URL: ${{ secrets.AUGMENT_API_URL }}
          
      - name: Upload index artifact
        uses: actions/upload-artifact@v4
        with:
          name: context-index-${{ github.ref_name }}
          path: .context-connectors/
          retention-days: 30
```

## Acceptance Criteria

- [ ] `npm run build` compiles without errors
- [ ] GitHubSource implements full Source interface
- [ ] `npm run cli index -s github --owner <owner> --repo <repo> -k <key>` works
- [ ] Incremental indexing works when previous state exists
- [ ] Force push triggers full re-index
- [ ] Changes to .gitignore/.augmentignore trigger full re-index
- [ ] `listFiles()` returns file list without reading contents
- [ ] `readFile(path)` fetches single file from GitHub
- [ ] All tests pass

## Testing

### `src/sources/github.test.ts`

**Unit tests (mock Octokit):**
- resolveRef returns commit SHA
- fetchAll downloads and extracts tarball
- fetchAll applies filtering correctly
- fetchChanges returns null for force push
- fetchChanges returns null when ignore files changed
- fetchChanges returns FileChanges for normal push
- listFiles returns file paths
- readFile returns file contents
- readFile returns null for missing file
- getMetadata returns correct values

**Integration tests (requires GITHUB_TOKEN, skip if not set):**
- Can index a public repository
- Can fetch changes between commits
- Can read individual files

```typescript
describe("GitHubSource", () => {
  const hasToken = !!process.env.GITHUB_TOKEN;

  describe.skipIf(!hasToken)("integration", () => {
    it("indexes a public repo", async () => {
      const source = new GitHubSource({
        owner: "octocat",
        repo: "Hello-World",
        ref: "master",
      });

      const files = await source.fetchAll();
      expect(files.length).toBeGreaterThan(0);
    });
  });
});
```

## Implementation Notes

### Tarball Extraction

The tarball has a root directory prefix like `owner-repo-sha/` that must be stripped:

```typescript
const pathParts = entry.path.split("/");
pathParts.shift(); // Remove root directory
const filePath = pathParts.join("/");
```

### Force Push Detection

Compare API throws an error when base commit is not an ancestor of head (force push scenario):

```typescript
async isForcePush(base: string, head: string): Promise<boolean> {
  try {
    await this.octokit.repos.compareCommits({ owner, repo, base, head });
    return false;
  } catch {
    return true; // Comparison failed = force push
  }
}
```

### Incremental Update Logic

In `fetchChanges(previous)`:

1. Check if `previous.ref` is valid commit SHA
2. If `isForcePush(previous.ref, currentRef)` → return null
3. If `ignoreFilesChanged(previous.ref, currentRef)` → return null
4. Get changes via `compareCommits`
5. If too many changes (>100 files?), consider returning null
6. Download contents for added/modified files
7. Return `FileChanges { added, modified, removed }`

### Optional Peer Dependency Check

At the top of github.ts:

```typescript
let Octokit: typeof import("@octokit/rest").Octokit;
try {
  Octokit = (await import("@octokit/rest")).Octokit;
} catch {
  throw new Error(
    "GitHubSource requires @octokit/rest. Install it with: npm install @octokit/rest"
  );
}
```

### listFiles Optimization

For `listFiles()`, we can use the Git Trees API instead of downloading the full tarball:

```typescript
async listFiles(): Promise<FileInfo[]> {
  const sha = await this.resolveRef();
  const { data } = await this.octokit.git.getTree({
    owner: this.owner,
    repo: this.repo,
    tree_sha: sha,
    recursive: "true",
  });

  return data.tree
    .filter(item => item.type === "blob")
    .map(item => ({ path: item.path! }));
}
```

This is much faster than downloading the tarball for listing files.

## CLI Usage Examples

```bash
# Index a GitHub repository
npm run cli index -s github --owner microsoft --repo vscode --ref main -k vscode

# Index with custom store path
npm run cli index -s github --owner facebook --repo react -k react --store-path ./my-indexes

# Search the indexed repo
npm run cli search "useState hook" -k react

# Search with source for readFile capability
npm run cli search "component" -k react --with-source
```

## Notes

- `@octokit/rest` must be installed separately: `npm install @octokit/rest`
- GITHUB_TOKEN needs `repo` scope for private repos, `public_repo` for public
- Rate limits: 5000 requests/hour with token, 60/hour without
- Large repos may take time to download tarball (consider progress indicator)

