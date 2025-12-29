/**
 * CLI command: init
 * Creates GitHub workflow for repository indexing
 */

import { Command } from "commander";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

interface GitInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
}

/**
 * Try to detect git remote info from the current directory
 */
function detectGitInfo(): GitInfo | null {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // Parse GitHub URL (https or ssh)
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    const httpsMatch = remoteUrl.match(
      /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/
    );
    const sshMatch = remoteUrl.match(/github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
    const match = httpsMatch || sshMatch;

    if (!match) {
      return null;
    }

    // Try to get default branch
    let defaultBranch = "main";
    try {
      const branch = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      defaultBranch = branch.replace("refs/remotes/origin/", "");
    } catch {
      // Fall back to main
    }

    return {
      owner: match[1],
      repo: match[2],
      defaultBranch,
    };
  } catch {
    return null;
  }
}

function generateWorkflow(
  owner: string,
  repo: string,
  branch: string,
  indexKey: string
): string {
  return `name: Index Repository

on:
  push:
    branches: [${branch}]
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
          key: index-\${{ github.repository }}-\${{ github.ref_name }}
          restore-keys: |
            index-\${{ github.repository }}-
            
      - name: Index repository
        run: |
          context-connectors index \\
            -s github \\
            --owner ${owner} \\
            --repo ${repo} \\
            --ref \${{ github.sha }} \\
            -n ${indexKey}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          AUGMENT_API_TOKEN: \${{ secrets.AUGMENT_API_TOKEN }}
          AUGMENT_API_URL: \${{ secrets.AUGMENT_API_URL }}
`;
}

async function runInit(options: {
  branch?: string;
  key?: string;
  force?: boolean;
}): Promise<void> {
  console.log(colorize("bright", "\n🚀 Augment Context Connectors - GitHub Setup\n"));

  // Detect git info
  const gitInfo = detectGitInfo();
  if (!gitInfo) {
    console.error(
      "❌ Could not detect GitHub repository. Make sure you're in a git repo with a GitHub remote."
    );
    process.exit(1);
  }

  const { owner, repo, defaultBranch } = gitInfo;
  const branch = options.branch || defaultBranch;
  const indexKey = options.name || `${owner}/${repo}`;

  console.log(colorize("cyan", "Detected repository:"));
  console.log(`  Owner: ${owner}`);
  console.log(`  Repo: ${repo}`);
  console.log(`  Branch: ${branch}`);
  console.log(`  Index key: ${indexKey}\n`);

  // Create workflow directory
  const workflowDir = join(process.cwd(), ".github", "workflows");
  const workflowPath = join(workflowDir, "augment-index.yml");

  // Check if workflow already exists
  try {
    await fs.access(workflowPath);
    if (!options.force) {
      console.error(
        `❌ Workflow already exists at ${workflowPath}\n   Use --force to overwrite.`
      );
      process.exit(1);
    }
  } catch {
    // File doesn't exist, that's fine
  }

  // Create directory and write workflow
  await fs.mkdir(workflowDir, { recursive: true });
  const workflowContent = generateWorkflow(owner, repo, branch, indexKey);
  await fs.writeFile(workflowPath, workflowContent);

  console.log(colorize("green", "✅ Created .github/workflows/augment-index.yml\n"));

  // Print next steps
  console.log(colorize("bright", "📋 Next Steps:\n"));

  console.log(colorize("yellow", "1. Set up GitHub repository secrets:"));
  console.log("   Go to your repository Settings > Secrets and variables > Actions");
  console.log("   Add the following secrets:");
  console.log("   • AUGMENT_API_TOKEN - Your Augment API token");
  console.log("   • AUGMENT_API_URL - Your tenant-specific Augment API URL\n");

  console.log(colorize("yellow", "2. Commit and push:"));
  console.log("   git add .github/workflows/augment-index.yml");
  console.log('   git commit -m "Add Augment indexing workflow"');
  console.log("   git push\n");

  console.log(colorize("yellow", "3. Test locally (optional):"));
  console.log('   export AUGMENT_API_TOKEN="your-token"');
  console.log('   export AUGMENT_API_URL="https://your-tenant.api.augmentcode.com/"');
  console.log('   export GITHUB_TOKEN="your-github-token"');
  console.log(`   npx @augmentcode/context-connectors index -s github --owner ${owner} --repo ${repo} -n ${indexKey}\n`);

  console.log(
    colorize("green", "The workflow will automatically run on pushes to the " + branch + " branch!")
  );
}

export const initCommand = new Command("init")
  .description("Initialize GitHub Actions workflow for repository indexing")
  .option("-b, --branch <branch>", "Branch to index (default: auto-detect)")
  .option("-n, --name <name>", "Index name (default: owner/repo)")
  .option("-f, --force", "Overwrite existing workflow file")
  .action(runInit);

