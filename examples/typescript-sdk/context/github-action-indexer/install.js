#!/usr/bin/env node

/**
 * GitHub Action Indexer Installation Script
 * 
 * This script helps developers install the Augment GitHub Action Indexer
 * into their repositories with minimal setup.
 * 
 * Usage:
 *   npx @augment-samples/github-action-indexer install
 *   node install.js
 */

import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(colorize(color, message));
}

function logStep(step, message) {
  log(`[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Configuration options
const defaultConfig = {
  template: 'basic', // 'basic' or 'multi-branch'
  repositorySize: 'medium', // 'small', 'medium', 'large'
  nodeVersion: '20',
};

// Performance settings based on repository size
const performanceSettings = {
  small: { maxCommits: 50, maxFiles: 200 },
  medium: { maxCommits: 100, maxFiles: 500 },
  large: { maxCommits: 200, maxFiles: 1000 },
};

// File templates
const packageJsonTemplate = {
  "name": "augment-github-indexer",
  "version": "1.0.0",
  "description": "Augment GitHub Action repository indexer",
  "type": "module",
  "scripts": {
    "index": "tsx src/index.ts",
    "search": "tsx src/search.ts",
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest"
  },
  "keywords": [
    "augment",
    "github",
    "indexing",
    "sdk"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "@augmentcode/auggie-sdk": "^0.1.6",
    "@octokit/rest": "^20.0.2",
    "ignore": "^5.3.0",
    "tar": "^6.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/tar": "^6.1.10",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.1.0"
  }
};

const tsconfigTemplate = {
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
};

const gitignoreTemplate = `# Dependencies
node_modules/

# Build output
dist/

# Index state
.augment-index-state/

# Environment variables
.env
.env.local

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
`;

function generateWorkflowTemplate(config) {
  const settings = performanceSettings[config.repositorySize];

  if (config.template === 'basic') {
    return `name: Index Repository

on:
  push:
    branches:
      - main

jobs:
  index:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for comparison

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${config.nodeVersion}'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Restore index state
        uses: actions/cache@v4
        with:
          path: .augment-index-state
          key: augment-index-\${{ github.ref_name }}-\${{ github.sha }}
          restore-keys: |
            augment-index-\${{ github.ref_name }}-

      - name: Index repository
        run: npm run index
        env:
          AUGMENT_API_TOKEN: \${{ secrets.AUGMENT_API_TOKEN }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          MAX_COMMITS: ${settings.maxCommits}
          MAX_FILES: ${settings.maxFiles}
`;
  } else {
    // multi-branch template
    return `name: Index Repository

on:
  push:
    branches:
      - main
      - develop
      - 'feature/**'
      - 'release/**'
  workflow_dispatch:
    inputs:
      force_full_reindex:
        description: 'Force full re-index'
        required: false
        type: boolean
        default: false

jobs:
  index:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for comparison

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${config.nodeVersion}'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Restore index state
        uses: actions/cache@v4
        with:
          path: .augment-index-state
          key: augment-index-\${{ github.ref_name }}-\${{ github.sha }}
          restore-keys: |
            augment-index-\${{ github.ref_name }}-

      - name: Index repository
        id: index
        run: npm run index
        env:
          AUGMENT_API_TOKEN: \${{ secrets.AUGMENT_API_TOKEN }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          MAX_COMMITS: ${settings.maxCommits}
          MAX_FILES: ${settings.maxFiles}

      - name: Print results
        if: always()
        run: |
          echo "Success: \${{ steps.index.outputs.success }}"
          echo "Type: \${{ steps.index.outputs.type }}"
          echo "Files Indexed: \${{ steps.index.outputs.files_indexed }}"
          echo "Files Deleted: \${{ steps.index.outputs.files_deleted }}"
          echo "Checkpoint ID: \${{ steps.index.outputs.checkpoint_id }}"
          echo "Commit SHA: \${{ steps.index.outputs.commit_sha }}"
`;
  }
}

async function checkTargetDirectory(targetDir) {
  try {
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      throw new Error(`${targetDir} is not a directory`);
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function copySourceFiles(sourceDir, targetDir) {
  const srcDir = join(sourceDir, 'src');
  const targetSrcDir = join(targetDir, 'src');
  
  // Create target src directory
  await fs.mkdir(targetSrcDir, { recursive: true });
  
  // Copy all TypeScript source files
  const files = await fs.readdir(srcDir);
  for (const file of files) {
    if (file.endsWith('.ts')) {
      const sourcePath = join(srcDir, file);
      const targetPath = join(targetSrcDir, file);
      await fs.copyFile(sourcePath, targetPath);
      logSuccess(`Copied ${file}`);
    }
  }
}

async function createConfigFiles(targetDir, config) {
  // Create package.json
  const packageJsonPath = join(targetDir, 'package.json');
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJsonTemplate, null, 2));
  logSuccess('Created package.json');
  
  // Create tsconfig.json
  const tsconfigPath = join(targetDir, 'tsconfig.json');
  await fs.writeFile(tsconfigPath, JSON.stringify(tsconfigTemplate, null, 2));
  logSuccess('Created tsconfig.json');
  
  // Create or update .gitignore
  const gitignorePath = join(targetDir, '.gitignore');
  let existingGitignore = '';
  try {
    existingGitignore = await fs.readFile(gitignorePath, 'utf-8');
  } catch (error) {
    // File doesn't exist, that's fine
  }
  
  if (!existingGitignore.includes('.augment-index-state/')) {
    const updatedGitignore = existingGitignore + (existingGitignore ? '\n\n' : '') + 
      '# Augment indexer files\n.augment-index-state/\n';
    await fs.writeFile(gitignorePath, updatedGitignore);
    logSuccess('Updated .gitignore');
  } else {
    logWarning('.gitignore already contains Augment indexer entries');
  }
}

async function createWorkflowFile(targetDir, config) {
  const workflowDir = join(targetDir, '.github', 'workflows');
  await fs.mkdir(workflowDir, { recursive: true });
  
  const workflowPath = join(workflowDir, 'augment-index.yml');
  const workflowContent = generateWorkflowTemplate(config);
  
  await fs.writeFile(workflowPath, workflowContent);
  logSuccess('Created GitHub workflow file');
}

function getDefaultConfiguration() {
  // Use opinionated defaults for zero-question setup
  const config = {
    template: 'basic',           // Basic template (main branch only) works for 80% of projects
    repositorySize: 'medium',    // Medium settings work well for most repositories
    nodeVersion: '20',
  };

  const settings = performanceSettings[config.repositorySize];
  log('\n' + colorize('bright', '🔧 Configuration'));
  log(colorize('green', 'Using optimized defaults:'));
  log(`• Template: Basic (indexes main branch only)`);
  log(`• Performance: Medium repository settings (${settings.maxCommits} max commits, ${settings.maxFiles} max files)`);
  log(`• Node.js version: ${config.nodeVersion}\n`);

  log(colorize('blue', 'Need different settings? You can customize the generated workflow file after installation.\n'));

  return config;
}

async function displayNextSteps(targetDir) {
  log('\n' + colorize('bright', '🎉 Installation Complete!'));
  log('\nNext steps:\n');
  
  log(colorize('yellow', '1. Install dependencies:'));
  log('   cd ' + targetDir);
  log('   npm install\n');
  
  log(colorize('yellow', '2. Set up GitHub repository secrets:'));
  log('   Go to your repository Settings > Secrets and variables > Actions');
  log('   Add the following secrets:');
  log('   • AUGMENT_API_TOKEN - Your Augment API token');
  log('   • AUGMENT_API_URL - Your tenant-specific Augment API URL\n');
  
  log(colorize('yellow', '3. Test locally (optional):'));
  log('   export AUGMENT_API_TOKEN="your-token"');
  log('   export AUGMENT_API_URL="https://your-tenant.api.augmentcode.com/"');
  log('   export GITHUB_TOKEN="your-github-token"');
  log('   export GITHUB_REPOSITORY="owner/repo"');
  log('   export GITHUB_SHA="$(git rev-parse HEAD)"');
  log('   npm run index\n');
  
  log(colorize('yellow', '4. Push to trigger the workflow:'));
  log('   git add .');
  log('   git commit -m "Add Augment GitHub Action Indexer"');
  log('   git push\n');
  
  log(colorize('green', 'The indexer will automatically run on pushes to your configured branches!'));
  log(colorize('blue', '\nFor more information, see the documentation at:'));
  log('https://github.com/augmentcode/auggie/tree/main/examples/typescript-sdk/context/github-action-indexer\n');
}

async function main() {
  try {
    log(colorize('bright', '🚀 Augment GitHub Action Indexer Installation'));
    log('This script will set up the Augment GitHub Action Indexer in your repository.\n');

    // Get target directory
    const args = process.argv.slice(2);
    let targetDir = args[0] || process.cwd();
    targetDir = resolve(targetDir);

    log(colorize('bright', '📁 Target Directory'));
    if (args[0]) {
      log(`Installing to specified directory: ${colorize('cyan', targetDir)}`);
    } else {
      log(`Installing to current directory: ${colorize('cyan', targetDir)}`);
      log(colorize('blue', 'Tip: You can specify a different directory: npx @augment-samples/github-action-indexer install /path/to/repo'));
    }
    log('');

    // Check if target directory exists
    const dirExists = await checkTargetDirectory(targetDir);
    if (!dirExists) {
      const create = await question(`Directory ${targetDir} doesn't exist. Create it? (y/N): `);
      if (!create.toLowerCase().startsWith('y')) {
        log('Installation cancelled.');
        process.exit(0);
      }
      await fs.mkdir(targetDir, { recursive: true });
      logSuccess(`Created directory ${targetDir}`);
    }

    // Check if this looks like a git repository
    const gitDir = join(targetDir, '.git');
    const isGitRepo = await checkTargetDirectory(gitDir);
    if (!isGitRepo) {
      logWarning('This doesn\'t appear to be a Git repository. The GitHub Action will only work in a Git repository.');
      const continue_ = await question('Continue anyway? (y/N): ');
      if (!continue_.toLowerCase().startsWith('y')) {
        log('Installation cancelled.');
        process.exit(0);
      }
    }

    // Get configuration (no questions, use defaults)
    const config = getDefaultConfiguration();

    logStep('1', 'Copying source files...');
    await copySourceFiles(__dirname, targetDir);

    logStep('2', 'Creating configuration files...');
    await createConfigFiles(targetDir, config);

    logStep('3', 'Creating GitHub workflow...');
    await createWorkflowFile(targetDir, config);
    
    await displayNextSteps(targetDir);
    
  } catch (error) {
    logError(`Installation failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\nInstallation cancelled by user.');
  rl.close();
  process.exit(0);
});

main();
