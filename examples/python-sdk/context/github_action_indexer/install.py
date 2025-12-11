#!/usr/bin/env python3
"""
GitHub Action Indexer Installation Script

This script helps developers install the Augment GitHub Action Indexer
into their repositories with minimal setup.

Usage:
    python install.py /path/to/your/repository
    python install.py  # installs to current directory
"""

import argparse
import shutil
import sys
from pathlib import Path

# Colors for console output
COLORS = {
    "reset": "\033[0m",
    "bright": "\033[1m",
    "red": "\033[31m",
    "green": "\033[32m",
    "yellow": "\033[33m",
    "blue": "\033[34m",
    "cyan": "\033[36m",
}


def colorize(color: str, text: str) -> str:
    """Apply color to text."""
    return f"{COLORS.get(color, '')}{text}{COLORS['reset']}"


def log(message: str, color: str = "reset") -> None:
    """Print a colored message."""
    print(colorize(color, message))


def log_step(step: str, message: str) -> None:
    """Print a step message."""
    log(f"[{step}] {message}", "cyan")


def log_success(message: str) -> None:
    """Print a success message."""
    log(f"✅ {message}", "green")


def log_warning(message: str) -> None:
    """Print a warning message."""
    log(f"⚠️  {message}", "yellow")


def log_error(message: str) -> None:
    """Print an error message."""
    log(f"❌ {message}", "red")


def copy_directory(src: Path, dst: Path) -> None:
    """Copy a directory recursively, excluding __pycache__ and .pyc files."""
    if dst.exists():
        shutil.rmtree(dst)
    
    def ignore_patterns(directory: str, files: list[str]) -> list[str]:
        return [f for f in files if f == "__pycache__" or f.endswith(".pyc")]
    
    shutil.copytree(src, dst, ignore=ignore_patterns)


def update_gitignore(target_dir: Path) -> None:
    """Update .gitignore to include Augment indexer entries."""
    gitignore_path = target_dir / ".gitignore"
    augment_entry = ".augment-index-state/"
    
    existing_content = ""
    if gitignore_path.exists():
        existing_content = gitignore_path.read_text()
    
    if augment_entry not in existing_content:
        addition = "\n# Augment indexer files\n.augment-index-state/\n"
        if existing_content and not existing_content.endswith("\n"):
            addition = "\n" + addition
        gitignore_path.write_text(existing_content + addition)
        log_success("Updated .gitignore")
    else:
        log_warning(".gitignore already contains Augment indexer entries")


def display_next_steps(target_dir: Path) -> None:
    """Display next steps after installation."""
    log("\n" + colorize("bright", "🎉 Installation Complete!"))
    log("\nNext steps:\n")

    log(colorize("yellow", "1. Set up GitHub repository secrets:"))
    log("   Go to your repository Settings > Secrets and variables > Actions")
    log("   Add the following secrets:")
    log("   • AUGMENT_API_TOKEN - Your Augment API token")
    log("   • AUGMENT_API_URL - Your tenant-specific Augment API URL\n")

    log(colorize("yellow", "2. Push to trigger the workflow:"))
    log("   git add .")
    log('   git commit -m "Add Augment GitHub Action Indexer"')
    log("   git push\n")

    log(colorize("green", "The indexer will automatically run on pushes to main!"))

    log(colorize("yellow", "\n(Optional) Test locally first:"))
    log(f"   cd {target_dir}")
    log("   pip install -r augment_indexer/requirements.txt")
    log('   export AUGMENT_API_TOKEN="your-token"')
    log('   export AUGMENT_API_URL="https://your-tenant.api.augmentcode.com/"')
    log('   export GITHUB_TOKEN="your-github-token"')
    log('   export GITHUB_REPOSITORY="owner/repo"')
    log('   export GITHUB_SHA="$(git rev-parse HEAD)"')
    log("   python -m augment_indexer.main")
    log(colorize("blue", "\nFor more information, see the documentation at:"))
    log("https://github.com/augmentcode/auggie/tree/main/examples/python-sdk/context/github_action_indexer\n")


def main() -> None:
    """Main installation function."""
    parser = argparse.ArgumentParser(
        description="Install the Augment GitHub Action Indexer into your repository"
    )
    parser.add_argument(
        "target_dir",
        nargs="?",
        default=".",
        help="Target directory to install into (default: current directory)",
    )
    args = parser.parse_args()

    # Resolve paths
    script_dir = Path(__file__).parent.resolve()
    target_dir = Path(args.target_dir).resolve()

    log(colorize("bright", "🚀 Augment GitHub Action Indexer Installation"))
    log("This script will set up the Augment GitHub Action Indexer in your repository.\n")

    log(colorize("bright", "📁 Target Directory"))
    log(f"Installing to: {colorize('cyan', str(target_dir))}\n")

    # Check if target directory exists
    if not target_dir.exists():
        response = input(f"Directory {target_dir} doesn't exist. Create it? (y/N): ")
        if not response.lower().startswith("y"):
            log("Installation cancelled.")
            sys.exit(0)
        target_dir.mkdir(parents=True)
        log_success(f"Created directory {target_dir}")

    # Check if this looks like a git repository
    if not (target_dir / ".git").is_dir():
        log_warning("This doesn't appear to be a Git repository.")
        response = input("Continue anyway? (y/N): ")
        if not response.lower().startswith("y"):
            log("Installation cancelled.")
            sys.exit(0)

    try:
        # Step 1: Copy augment_indexer directory (includes requirements.txt)
        log_step("1", "Copying augment_indexer directory...")
        src_indexer = script_dir / "augment_indexer"
        dst_indexer = target_dir / "augment_indexer"
        copy_directory(src_indexer, dst_indexer)
        log_success("Copied augment_indexer/ (includes requirements.txt)")

        # Step 2: Copy GitHub workflow
        log_step("2", "Creating GitHub workflow...")
        src_workflow = script_dir / ".github" / "workflows" / "augment-index.yml"
        dst_workflow_dir = target_dir / ".github" / "workflows"
        dst_workflow_dir.mkdir(parents=True, exist_ok=True)
        dst_workflow = dst_workflow_dir / "augment-index.yml"
        shutil.copy(src_workflow, dst_workflow)
        log_success("Created .github/workflows/augment-index.yml")

        # Step 3: Update .gitignore
        log_step("3", "Updating .gitignore...")
        update_gitignore(target_dir)

        # Display next steps
        display_next_steps(target_dir)

    except Exception as e:
        log_error(f"Installation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

