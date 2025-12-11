# GitHub Action Repository Indexer

A Python example showing how to index a GitHub repository using the Augment SDK Direct Mode with incremental updates.

## Overview

This example demonstrates:
- Incremental indexing using GitHub's Compare API
- State persistence using file system storage
- Automatic fallback to full re-index when needed
- GitHub Actions integration

## Prerequisites

### Getting Your API Credentials

1. **Authenticate to get your credentials if you have not already:**
   ```bash
   auggie login
   ```
   This opens a browser for authentication and stores your credentials at `~/.augment/session.json`.

2. **Extract the values for environment variables:**
   ```bash
   # View your session file to get the values
   cat ~/.augment/session.json
   ```
   - `AUGMENT_API_TOKEN`: Use the `accessToken` value from the session file
   - `AUGMENT_API_URL`: Use the `baseUrl` value from the session file

### GitHub Token

For the `GITHUB_TOKEN`, you need a GitHub Personal Access Token with `repo` scope (for private repos) or `public_repo` scope (for public repos only). [Create one here](https://github.com/settings/tokens).

## Two Ways to Use This Example

There are two ways to use this indexer:

| Mode | Description | Best For |
|------|-------------|----------|
| **Local Testing** | Run from this examples directory to index any GitHub repo | Trying out the indexer, testing on existing repos |
| **GitHub Actions** | Copy the code into your own repo for automatic indexing | Production use, CI/CD integration |

---

## Option 1: Local Testing (Quick Start)

Test the indexer on any GitHub repository without copying any files. This downloads the repo via the GitHub API and indexes it.

### Example: Index the facebook/react Repository

```bash
# Navigate to the context examples directory
cd examples/python-sdk/context

# Install dependencies
pip install -r github_action_indexer/augment_indexer/requirements.txt

# Set your credentials (see Prerequisites section above)
export AUGMENT_API_TOKEN="your-token"      # From ~/.augment/session.json
export AUGMENT_API_URL="your-url"          # From ~/.augment/session.json
export GITHUB_TOKEN="your-github-token"    # Your GitHub PAT

# Index a public repository (e.g., facebook/react)
export GITHUB_REPOSITORY="facebook/react"
export GITHUB_SHA="main"

# Run the indexer
python -m github_action_indexer index

# Search the indexed repository
python -m github_action_indexer search "hooks implementation"
python -m github_action_indexer search "reconciler algorithm"
```

### Index Your Own Repository

```bash
# Set to any repo you have access to
export GITHUB_REPOSITORY="your-username/your-repo"
export GITHUB_SHA="main"  # or a specific commit SHA

python -m github_action_indexer index
python -m github_action_indexer search "your search query"
```

The index state is saved to `.augment-index-state/{branch}/state.json`, so subsequent runs perform incremental updates.

---

## Option 2: GitHub Actions Setup (Production Use)

For automatic indexing of your repository on every push, install the indexer into your repository.

### Quick Install

```bash
# From the auggie repo, install into your target repository
cd examples/python-sdk/context
python -m github_action_indexer install /path/to/your/repo
```

This will:
- Copy the `augment_indexer/` directory (includes `requirements.txt`)
- Create `.github/workflows/augment-index.yml`
- Update `.gitignore`

### Manual Installation

If you prefer to install manually:

1. **Copy the indexer code** to your repository root. The workflow expects the following structure:
   ```
   your-repo/
   ├── .github/workflows/augment-index.yml
   └── augment_indexer/
       ├── main.py (and other indexer source files)
       └── requirements.txt
   ```

2. **Copy the workflow file** from [`.github/workflows/augment-index.yml`](.github/workflows/augment-index.yml) to your repository's `.github/workflows/` directory.

### Configure Secrets

After installing (either method), add your API credentials to repository secrets:

1. Go to Settings → Secrets and variables → Actions
2. Add `AUGMENT_API_TOKEN` with your Augment API token
3. Add `AUGMENT_API_URL` with your tenant-specific URL (e.g., `https://your-tenant.api.augmentcode.com/`)

> **Note:** Do not include quotes around the secret values. Enter the raw values directly (e.g., `https://...` not `"https://..."`).

### Push to trigger indexing

The workflow will run automatically on every push to `main`

The GitHub Actions cache will persist the index state between runs, enabling incremental updates.

### Downloading and Using Artifacts

After the workflow runs, you can download the index state artifact and use it for local searching:

1. Go to the workflow run page (Actions tab → select the run)
2. Scroll to "Artifacts" section at the bottom
3. Download `index-state`
4. Extract and use it:

```bash
# Navigate to the context examples directory
cd examples/python-sdk/context

# Extract the downloaded artifact
# It will contain a {branch}/ directory with state.json (e.g., main/state.json)
unzip ~/Downloads/index-state.zip -d .augment-index-state

# Set your credentials
export AUGMENT_API_TOKEN="your-token"
export AUGMENT_API_URL="https://your-tenant.api.augmentcode.com/"
export BRANCH="main"  # or whatever branch you indexed

# Now you can search!
python -m github_action_indexer search "authentication functions"
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

The indexer can be adapted to use other storage backends like Redis, S3, or databases. The state save/load operations in `augment_indexer/index_manager.py` can be modified to work with any storage system that can persist JSON data.

## Searching the Index

After indexing, you can search the repository using the CLI tool:

```bash
# From the context examples directory
cd examples/python-sdk/context

# Search for specific functionality
python -m github_action_indexer search "authentication functions"

# Search for error handling patterns
python -m github_action_indexer search "error handling"

# Search for specific implementations
python -m github_action_indexer search "database queries"
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

