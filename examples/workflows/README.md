# GitHub Workflows

GitHub Actions workflows for integrating Augment's AI-powered code review and PR descriptions.

## Installation

### Install All Workflows
```bash
mkdir -p .github/workflows
cd .github/workflows
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/workflows/describe-pr.yml
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/workflows/pr-review.yml
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/workflows/on-demand-description.yml
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/workflows/on-demand-review.yml
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/workflows/release.yml
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/workflows/test-action.yml
git add .github/workflows/
git commit -m "Add Augment AI workflows"
git push
```

### Install Specific Workflows
```bash
mkdir -p .github/workflows
cd .github/workflows
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/workflows/describe-pr.yml
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/workflows/pr-review.yml
git add .github/workflows/
git commit -m "Add Augment AI workflows"
git push
```

## Setup

**Required Secret**: Add `AUGMENT_SESSION_AUTH` to your repository:
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `AUGMENT_SESSION_AUTH`
4. Value: Your Augment session authentication token

## Available Workflows

**Automatic**:
- `describe-pr.yml` - Auto-generates PR descriptions
- `pr-review.yml` - Auto-reviews new PRs

**On-Demand** (triggered by labels):
- `on-demand-description.yml` - Add `augment_describe` label
- `on-demand-review.yml` - Add `augment_review` label

**Other**:
- `release.yml` - Automated release notes
- `test-action.yml` - Manual testing

## Customization

Edit the `.yml` files to modify triggers, parameters, or add additional steps.
