# GitHub Action Repository Indexer

A TypeScript example showing how to index a GitHub repository using the Augment SDK Direct Mode with incremental updates.

## Overview

This example demonstrates:
- **Incremental indexing** using GitHub's Compare API
- **State persistence** for efficient updates
- **Automatic fallback** to full re-index when needed
- **Local development** and **GitHub Actions** support

## Try It Locally First

The quickest way to see how this works is to try it locally:

```bash
# Clone the repository
git clone https://github.com/augmentcode/auggie.git
cd auggie/examples/typescript-sdk/context/github-action-indexer

# Install dependencies
npm install

# Set required environment variables
export AUGMENT_API_TOKEN="your-token"
export AUGMENT_API_URL="https://your-tenant.api.augmentcode.com/"
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPOSITORY="owner/repo"
export GITHUB_SHA="$(git rev-parse HEAD)"

# Index the repository
npm run index

# Search the indexed repository
npm run search "authentication functions"
npm run search "error handling"
```

The index state is saved to `.augment-index-state/state.json` by default, so subsequent runs will perform incremental updates.

## Deploy to Production (GitHub Actions)

Once you've tested locally, you can deploy the indexer to run automatically on every push using GitHub Actions.

### 1. Install the Indexer

Use the installation script to set up everything automatically:

```bash
# Install in current directory
cd /path/to/your/repository
npx @augment-samples/github-action-indexer install

# Or specify the repository path
npx @augment-samples/github-action-indexer install /path/to/your/repository
```

The installation script will:
- ✅ Create the GitHub workflow file (`.github/workflows/augment-index.yml`)
- ✅ Copy all necessary source files to your repository
- ✅ Set up TypeScript configuration with optimized defaults
- ✅ Update your `.gitignore`
- ✅ No questions asked - uses sensible defaults that work for most projects

### 2. Configure Repository Secrets

Add these secrets to your repository (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AUGMENT_API_TOKEN` | Your Augment API token | `your-token-here` |
| `AUGMENT_API_URL` | Your tenant-specific API URL | `https://your-tenant.api.augmentcode.com/` |

**Note:** `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, and `GITHUB_SHA` are automatically provided by GitHub Actions.

### 3. Push and Run

Push your changes to trigger the first indexing run. The workflow will:
- Index your repository automatically on every push
- Use incremental updates for efficiency
- Cache the index state between runs

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

## Customizing the Workflow

The installation script generates a workflow that indexes only the main branch by default. This works well for most projects.

If you need to index multiple branches, you can edit the generated workflow file (`.github/workflows/augment-index.yml`) to add additional branches:

```yaml
on:
  push:
    branches:
      - main
      - develop
      - 'feature/**'
```

You can also adjust performance settings by editing the `MAX_COMMITS` and `MAX_FILES` values in the workflow file if needed.

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Error:** `Authentication failed` or `Invalid API token`

**Solutions:**
- Verify `AUGMENT_API_TOKEN` is set correctly in repository secrets
- Check that `AUGMENT_API_URL` matches your tenant URL
- Ensure the token has necessary permissions

#### 2. Workflow Not Triggering

**Error:** Workflow doesn't run on push

**Solutions:**
- Check that the workflow file is in `.github/workflows/`
- Verify the branch name matches your push branch
- Ensure the workflow file has correct YAML syntax

#### 3. Index State Issues

**Error:** `Failed to load index state` or frequent full re-indexes

**Solutions:**
- Check GitHub Actions cache limits (10GB per repository)
- Verify `.augment-index-state/` is in `.gitignore`
- Re-run the installation script to ensure optimal performance settings

#### 4. Large Repository Performance

**Error:** Workflow times out or runs slowly

**Solutions:**
- Increase `timeout-minutes` in workflow (default: 360 minutes)
- Edit the workflow file to use larger performance settings (increase `MAX_COMMITS` and `MAX_FILES`)
- Consider indexing fewer branches or using manual dispatch

### Debug Mode

Enable debug logging by adding this to your workflow:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### Local Testing

Test the indexer locally before deploying:

```bash
# Set up environment
export AUGMENT_API_TOKEN="your-token"
export AUGMENT_API_URL="https://your-tenant.api.augmentcode.com/"
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPOSITORY="owner/repo"
export GITHUB_SHA="$(git rev-parse HEAD)"

# Run indexing
npm run index

# Test search
npm run search "your search query"
```

### Getting Help

1. **Check workflow logs** in your repository's Actions tab
2. **Review the troubleshooting guide** above
3. **Test locally** using the environment variables
4. **Open an issue** in the Augment repository with:
   - Your workflow file
   - Error messages from the logs
   - Repository size and structure details

## Storage Backends

The index state is stored as a JSON file on the file system by default (`.augment-index-state/{branch}/state.json`). In GitHub Actions, the state is persisted between runs using GitHub Actions cache for efficient incremental updates.

The indexer can be adapted to use other storage backends like Redis, S3, or databases. The state save/load operations in `src/index-manager.ts` can be modified to work with any storage system that can persist JSON data.

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

