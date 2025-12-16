# Phase 10: Documentation & Polish (Remaining Work)

## Already Completed

- [x] `README.md` - Comprehensive documentation with installation, quick start, CLI commands, programmatic usage, Claude Desktop integration, GitHub Actions workflow, environment variables, architecture, filtering
- [x] JSDoc comments on all public APIs (types, classes, functions)

## Remaining Tasks

### 1. CI Workflow

Create GitHub Actions workflow for the package itself.

#### File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: context-connectors/package-lock.json

      - name: Install dependencies
        working-directory: context-connectors
        run: npm ci

      - name: Lint
        working-directory: context-connectors
        run: npm run lint

      - name: Type check
        working-directory: context-connectors
        run: npm run build

      - name: Test
        working-directory: context-connectors
        run: npm test -- --run
        env:
          AUGMENT_API_TOKEN: ${{ secrets.AUGMENT_API_TOKEN }}

  publish:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"

      - name: Install and build
        working-directory: context-connectors
        run: |
          npm ci
          npm run build

      - name: Publish
        working-directory: context-connectors
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 2. package.json Updates

Ensure `package.json` has all required fields for npm publishing:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/augmentcode/auggie.git",
    "directory": "context-connectors"
  },
  "bugs": {
    "url": "https://github.com/augmentcode/auggie/issues"
  },
  "homepage": "https://github.com/augmentcode/auggie/tree/main/context-connectors#readme"
}
```

### 3. .npmignore

Create `.npmignore` to exclude unnecessary files from the published package:

```
# Source files (dist is published)
src/
*.ts
!*.d.ts

# Test files
*.test.ts
vitest.config.ts
coverage/

# Development
.github/
*.md
!README.md

# Phase docs
phase*.md
plan.md
```

## Verification

After completing all tasks:

1. **Build**: `npm run build` should pass
2. **Tests**: `npm test` should pass
3. **Lint**: `npm run lint` should pass
4. **Dry run publish**: `npm publish --dry-run` should show correct files

## Notes

- CI workflow assumes secrets `AUGMENT_API_TOKEN` and `NPM_TOKEN` are configured
- Consider adding a CHANGELOG.md for version history

