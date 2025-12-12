# GitHub Action Repository Indexer

A Python example showing how to index a GitHub repository using the Augment SDK Direct Mode with incremental updates.

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
pip install -r requirements.txt

# Set required environment variables
export AUGMENT_API_TOKEN="your-token"
export AUGMENT_API_URL="https://your-tenant.api.augmentcode.com/"  # Required: your tenant-specific URL
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPOSITORY="owner/repo"
export GITHUB_SHA="$(git rev-parse HEAD)"

# Index the repository (stores state in .augment-index-state/state.json)
python -m examples.context.github_action_indexer.main

# Search the indexed repository
python -m examples.context.github_action_indexer.search "authentication functions"
python -m examples.context.github_action_indexer.search "error handling"
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

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Cache index state
        uses: actions/cache@v4
        with:
          path: .augment-index-state
          key: augment-index-${{ github.ref_name }}-${{ github.sha }}
          restore-keys: |
            augment-index-${{ github.ref_name }}-

      - name: Index repository
        run: python -m examples.context.github_action_indexer.main
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
python -m examples.context.github_action_indexer.search "authentication functions"
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

## Storage Backends

The index state is stored as a JSON file on the file system by default (`.augment-index-state/{branch}/state.json`). In GitHub Actions, the state is persisted between runs using GitHub Actions cache for efficient incremental updates.

The indexer can be adapted to use other storage backends like Redis, S3, or databases. The state save/load operations in `src/index_manager.py` can be modified to work with any storage system that can persist JSON data.

## Searching the Index

After indexing, you can search the repository using the CLI tool:

```bash
# Search for specific functionality
python -m examples.context.github_action_indexer.search "authentication functions"

# Search for error handling patterns
python -m examples.context.github_action_indexer.search "error handling"

# Search for specific implementations
python -m examples.context.github_action_indexer.search "database queries"
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

📄 src/auth/login.py
   Lines 15-28
   ────────────────────────────────────────────────────────────
     15 │ async def authenticate_user(
     16 │     username: str,
     17 │     password: str
     18 │ ) -> User:
     19 │     # Authentication logic...
     20 │     ...
```

## License

MIT

