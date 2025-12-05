# Testing GitHub Action Indexer with GitHub Actions

This document describes how to test the GitHub Action Indexer using the workflow in `.github/workflows/test-indexer.yml`.

## Overview

The test workflow is configured to:
- Run on pushes to the `context-sdk` branch
- Index the `auggie-sdk-typescript` repository itself
- Use GitHub Actions cache for state persistence
- Support manual triggering via workflow_dispatch

## Setup Instructions

### 1. Add Repository Secrets

You need to add the following secrets to the `augmentcode/auggie-sdk-typescript` repository:

1. Go to: https://github.com/augmentcode/auggie-sdk-typescript/settings/secrets/actions
2. Add the following repository secrets:
   - **`AUGMENT_API_TOKEN`**: Your Augment API token
   - **`AUGMENT_API_URL`**: Your tenant-specific API URL (e.g., `https://staging-shard-0.api.augmentcode.com/`)

**Note:** `GITHUB_TOKEN` is automatically provided by GitHub Actions.

### 2. Commit and Push the Workflow

The workflow file has been created at `.github/workflows/test-indexer.yml`. To activate it:

```bash
# From the repository root
git add .github/workflows/test-indexer.yml
git commit -m "Add GitHub Action Indexer test workflow"
git push origin context-sdk
```

This will trigger the workflow automatically.

## How the Workflow Works

### Workflow Steps:

1. **Checkout repository** - Checks out the `auggie-sdk-typescript` repo with full history
2. **Setup Node.js** - Installs Node.js 20
3. **Install SDK dependencies** - Runs `npm ci` in the root to install SDK dependencies
4. **Build SDK** - Builds the SDK package
5. **Install indexer dependencies** - Installs dependencies for the indexer example
6. **Restore index state** - Restores cached state from previous runs (if available)
7. **Index repository** - Runs the indexer on the `auggie-sdk-typescript` repository
8. **Print results** - Displays indexing results (files indexed, type, etc.)
9. **Upload state artifact** - Saves the index state as an artifact for debugging

### Key Differences from Example Workflow:

The test workflow differs from `examples/github-action-indexer/.github/workflows/index.yml` in these ways:

1. **Triggers on `context-sdk` branch** instead of `main`
2. **Builds the SDK first** (`npm run build`) since the indexer depends on the local SDK
3. **Working directory** is `examples/github-action-indexer` for indexer steps
4. **Cache path** is `examples/github-action-indexer/.augment-index-state`
5. **Artifact name** includes branch name for clarity

## Testing Scenarios

### Test 1: Initial Full Index

**Expected behavior:** First run should perform a full index of the repository.

```bash
# Push the workflow file
git add .github/workflows/test-indexer.yml
git commit -m "Add test workflow"
git push origin context-sdk
```

**Check:**
- Go to Actions tab: https://github.com/augmentcode/auggie-sdk-typescript/actions
- Find the "Test GitHub Action Indexer" workflow
- Verify output shows:
  - `Type: full`
  - `Files Indexed: [number of files]`
  - `Success: true`

### Test 2: Incremental Update

**Expected behavior:** Second run with no changes should show incremental update with 0 files.

```bash
# Make a trivial change
echo "# Test" >> examples/github-action-indexer/README.md
git add examples/github-action-indexer/README.md
git commit -m "test: trigger incremental index"
git push origin context-sdk
```

**Check:**
- Workflow should show:
  - `Type: incremental`
  - `Files Indexed: 1` (only the changed README)
  - Cache should be restored from previous run

### Test 3: Manual Trigger

**Expected behavior:** Can manually trigger the workflow.

1. Go to: https://github.com/augmentcode/auggie-sdk-typescript/actions/workflows/test-indexer.yml
2. Click "Run workflow"
3. Select branch: `context-sdk`
4. Optionally check "Force full re-index"
5. Click "Run workflow"

### Test 4: Force Full Re-index

**Expected behavior:** Force a full re-index even when incremental would be possible.

1. Manually trigger workflow (as in Test 3)
2. Check "Force full re-index"
3. Verify output shows `Type: full` with re-index reason

## Viewing Results

### In GitHub Actions UI:

1. Go to: https://github.com/augmentcode/auggie-sdk-typescript/actions
2. Click on the workflow run
3. Click on the "index" job
4. Expand the "Print results" step to see:
   - Success status
   - Index type (full/incremental)
   - Number of files indexed/deleted
   - Checkpoint ID
   - Commit SHA

### Download State Artifact:

1. In the workflow run page, scroll to "Artifacts"
2. Download `index-state-context-sdk`
3. Extract and inspect `.augment-index-state/context-sdk/state.json`

## Troubleshooting

### Workflow doesn't trigger:

- Verify the workflow file is on the `context-sdk` branch
- Check that secrets are added to the repository
- Ensure you have Actions enabled for the repository

### Build fails:

- Check Node.js version (should be 20)
- Verify `npm ci` succeeds in the root directory
- Check that `npm run build` works locally

### Indexing fails:

- Verify `AUGMENT_API_TOKEN` and `AUGMENT_API_URL` secrets are set correctly
- Check the indexer logs for specific error messages
- Ensure the API token has necessary permissions

### Cache not working:

- First run won't have cache (expected)
- Subsequent runs should show "Cache restored from key: augment-index-context-sdk-..."
- Cache is branch-specific

## Next Steps

After successful testing on `auggie-sdk-typescript`:

1. **Adapt for other repositories** - Use this workflow as a template for indexing other repos
2. **Test on `igor0/lm-plot`** - Apply the workflow to your test repository
3. **Publish as reusable workflow** - Make it available for other repos to use
4. **Add search step** - Optionally add a search test step to verify the index works

## Files Created

- `.github/workflows/test-indexer.yml` - The test workflow file
- `examples/github-action-indexer/TESTING-GITHUB-ACTIONS.md` - This documentation

