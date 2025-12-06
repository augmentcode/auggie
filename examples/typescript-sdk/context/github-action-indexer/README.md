# GitHub Action Repository Indexer

A TypeScript example showing how to index a GitHub repository using the Augment SDK Direct Mode with incremental updates.

## Overview

This example demonstrates:
- Incremental indexing using GitHub's Compare API
- State persistence using file system storage
- Automatic fallback to full re-index when needed
- GitHub Actions integration

## Quick Start

### Local Usage

The simplest way to get started is to index and search a repository locally:

```bash
# Install dependencies
npm install

# Set required environment variables
export AUGMENT_API_TOKEN="your-token"
export AUGMENT_API_URL="https://your-tenant.api.augmentcode.com/"  # Required: your tenant-specific URL
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPOSITORY="owner/repo"
export GITHUB_SHA="$(git rev-parse HEAD)"

# Index the repository (stores state in .augment-index-state/state.json)
npm run index

# Search the indexed repository
npm run search "authentication functions"
npm run search "error handling"
```

The index state is saved to `.augment-index-state/state.json` by default, so subsequent runs will perform incremental updates.

## GitHub Actions Setup

To automatically index your repository on every push:

1. **Add the workflow file** to `.github/workflows/index.yml`:

```yaml
name: Index Repository
on:
  push:
    branches: [main]

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Needed for commit comparison

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Cache index state
        uses: actions/cache@v4
        with:
          path: .augment-index-state
          key: augment-index-${{ github.ref_name }}-${{ github.sha }}
          restore-keys: |
            augment-index-${{ github.ref_name }}-

      - name: Index repository
        run: npx tsx src/index.ts
        env:
          AUGMENT_API_TOKEN: ${{ secrets.AUGMENT_API_TOKEN }}
          AUGMENT_API_URL: ${{ secrets.AUGMENT_API_URL }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Optional: Upload state as artifact for local searching
      - name: Prepare state for upload
        if: success()
        run: |
          # Copy state to temp location (not in .gitignore)
          mkdir -p /tmp/augment-state-upload
          cp -r .augment-index-state/* /tmp/augment-state-upload/ 2>/dev/null || true

      - name: Upload state artifact
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: index-state-${{ github.ref_name }}
          path: /tmp/augment-state-upload/
          retention-days: 30
```

2. **Add your API credentials** to repository secrets:
   - Go to Settings → Secrets and variables → Actions
   - Add `AUGMENT_API_TOKEN` with your Augment API token
   - Add `AUGMENT_API_URL` with your tenant-specific URL (e.g., `https://your-tenant.api.augmentcode.com/`)

3. **Push to trigger indexing** - The workflow will run automatically on every push to `main`

The GitHub Actions cache will persist the index state between runs, enabling incremental updates.

### Important: Artifact Upload and .gitignore

The `.augment-index-state/` directory is in `.gitignore` to prevent committing index state. However, `upload-artifact@v4` respects `.gitignore` by default, which would prevent uploading the state as an artifact.

**Solution:** The workflow copies the state to `/tmp/augment-state-upload/` before uploading, which bypasses the `.gitignore` restriction.

### Downloading and Using Artifacts

After the workflow runs, you can download the index state artifact and use it for local searching:

1. Go to the workflow run page (Actions tab → select the run)
2. Scroll to "Artifacts" section at the bottom
3. Download `index-state-{branch}` (e.g., `index-state-main`)
4. Extract and use it:

```bash
cd path/to/this/example

# Extract the downloaded artifact
# It will contain a {branch}/ directory with state.json
unzip ~/Downloads/index-state-main.zip

# Move it to the expected location
mkdir -p .augment-index-state
mv main .augment-index-state/  # or whatever branch name

# Set your credentials
export AUGMENT_API_TOKEN="your-token"
export AUGMENT_API_URL="https://your-tenant.api.augmentcode.com/"
export BRANCH="main"  # or whatever branch you indexed

# Now you can search!
npm run search "authentication functions"
```

This allows you to search the indexed repository locally without re-indexing.

## Configuration

Key environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `AUGMENT_API_TOKEN` | Augment API token | Yes | - |
| `AUGMENT_API_URL` | Augment API URL (e.g., `https://your-tenant.api.augmentcode.com/`) | Yes | - |
| `GITHUB_TOKEN` | GitHub token for API access | Yes | Auto-provided in GitHub Actions |
| `GITHUB_REPOSITORY` | Repository in `owner/repo` format | Yes | Auto-provided in GitHub Actions |
| `GITHUB_SHA` | Commit SHA to index | Yes | Auto-provided in GitHub Actions |
| `STATE_PATH` | File path for state storage | No | `.augment-index-state/{branch}/state.json` |
| `MAX_COMMITS` | Max commits before full re-index | No | `100` |
| `MAX_FILES` | Max file changes before full re-index | No | `500` |

## How It Works

1. **Load previous state** from storage (if exists)
2. **Check if full re-index is needed**:
   - First run (no previous state)
   - Force push detected
   - Too many commits or file changes
   - Ignore files changed
3. **If full re-index**: Download tarball and index all files
4. **If incremental**: Use Compare API to index only changed files
5. **Save new state** to storage

## Storage

The index state is stored as a JSON file on the file system. By default, it's saved to `.augment-index-state/{branch}/state.json`, where `{branch}` is the sanitized branch name.

In GitHub Actions, the state is persisted between runs using GitHub Actions cache, enabling efficient incremental updates.

## Extending to Other Storage Backends

This example uses file system storage for simplicity, but you can easily adapt it to use other storage backends like Redis, S3, or a database.

### Where to Make Changes

The state save/load operations are located in `src/index-manager.ts`:

- **`loadState()`** method (lines ~48-60): Loads the index state from storage
- **`saveState()`** method (lines ~86-92): Saves the index state to storage

### How to Adapt for Other Storage

The index state is just a JSON object (`IndexState` type) that can be serialized and stored anywhere. Here's how to adapt the code:

#### Redis Example

```typescript
import Redis from 'ioredis';

private async loadState(): Promise<IndexState | null> {
  const redis = new Redis(process.env.REDIS_URL);
  const data = await redis.get(this.stateKey);
  await redis.quit();
  return data ? JSON.parse(data) : null;
}

private async saveState(state: IndexState): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL);
  await redis.set(this.stateKey, JSON.stringify(state));
  await redis.quit();
}
```

#### S3 Example

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

private async loadState(): Promise<IndexState | null> {
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: this.stateKey
    }));
    const data = await response.Body.transformToString();
    return JSON.parse(data);
  } catch (error) {
    if (error.name === 'NoSuchKey') return null;
    throw error;
  }
}

private async saveState(state: IndexState): Promise<void> {
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: this.stateKey,
    Body: JSON.stringify(state),
    ContentType: 'application/json'
  }));
}
```

#### Database Example

```typescript
private async loadState(): Promise<IndexState | null> {
  const result = await db.query(
    'SELECT state FROM index_states WHERE repo = $1 AND branch = $2',
    [this.config.repo, this.config.branch]
  );
  return result.rows[0]?.state || null;
}

private async saveState(state: IndexState): Promise<void> {
  await db.query(
    'INSERT INTO index_states (repo, branch, state) VALUES ($1, $2, $3) ON CONFLICT (repo, branch) DO UPDATE SET state = $3',
    [this.config.repo, this.config.branch, state]
  );
}
```

### When to Use Different Storage Backends

- **File System**: Best for single-instance deployments, local development, and GitHub Actions with cache
- **Redis**: Best for distributed systems where multiple workers need shared state, or when you need fast access
- **S3/Object Storage**: Best for long-term persistence, cross-region access, or when you want to decouple storage from compute
- **Database**: Best when you need to query or analyze index states, or when you already have a database infrastructure

## Searching the Index

After indexing, you can search the repository using the CLI tool:

```bash
# Search for specific functionality
npm run search "authentication functions"

# Search for error handling patterns
npm run search "error handling"

# Search for specific implementations
npm run search "database queries"
```

The search tool will:
1. Load the index state from storage
2. Perform semantic search using the Augment SDK
3. Display matching code chunks with file paths and line numbers

Example output:
```
Searching for: "authentication functions"

Loading index state...
Loaded index: 42 files indexed
Last indexed commit: abc123def456
Branch: main

Found 3 result(s):

📄 src/auth/login.ts
   Lines 15-28
   ────────────────────────────────────────────────────────────
     15 │ export async function authenticateUser(
     16 │   username: string,
     17 │   password: string
     18 │ ): Promise<User> {
     19 │   // Authentication logic...
     20 │ }
```

## License

MIT

