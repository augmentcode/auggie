#!/usr/bin/env python3
"""
Main entry point for GitHub Action Indexer

Usage:
    cd examples/python-sdk/context
    python -m github_action_indexer index
"""

import os
import re
import sys

from auggie_sdk.context import DirectContext

from .index_manager import IndexManager
from .models import IndexConfig


def get_api_credentials() -> tuple[str, str]:
    """Get API credentials from environment variables."""
    api_token = os.environ.get("AUGMENT_API_TOKEN")
    if not api_token:
        raise ValueError("AUGMENT_API_TOKEN environment variable is required")

    api_url = os.environ.get("AUGMENT_API_URL")
    if not api_url:
        raise ValueError(
            "AUGMENT_API_URL environment variable is required. Please set it to your "
            "tenant-specific URL (e.g., 'https://your-tenant.api.augmentcode.com/')"
        )

    return api_token, api_url


def parse_repository_info() -> tuple[str, str, str, str]:
    """
    Parse repository information from environment variables.
    Returns (owner, repo, branch, current_commit).
    """
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    parts = repository.split("/")

    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError('GITHUB_REPOSITORY must be in format "owner/repo"')

    owner, repo = parts

    # Extract branch name from GitHub ref
    github_ref = os.environ.get("GITHUB_REF", "")
    github_ref_name = os.environ.get("GITHUB_REF_NAME", "")

    if github_ref.startswith("refs/heads/"):
        branch = github_ref_name
    elif github_ref.startswith("refs/tags/"):
        branch = f"tag/{github_ref_name}"
    elif github_ref_name:
        branch = github_ref_name
    else:
        branch = os.environ.get("BRANCH", "main")

    current_commit = os.environ.get("GITHUB_SHA", "")
    if not current_commit:
        raise ValueError("GITHUB_SHA environment variable is required")

    return owner, repo, branch, current_commit


def load_config() -> IndexConfig:
    """Load configuration from environment variables."""
    github_token = os.environ.get("GITHUB_TOKEN")
    if not github_token:
        raise ValueError("GITHUB_TOKEN environment variable is required")

    api_token, api_url = get_api_credentials()
    owner, repo, branch, current_commit = parse_repository_info()

    max_commits = os.environ.get("MAX_COMMITS")
    max_files = os.environ.get("MAX_FILES")

    return IndexConfig(
        apiToken=api_token,
        apiUrl=api_url,
        githubToken=github_token,
        owner=owner,
        repo=repo,
        branch=branch,
        currentCommit=current_commit,
        maxCommits=int(max_commits) if max_commits else None,
        maxFiles=int(max_files) if max_files else None,
    )


def get_state_path(branch: str) -> str:
    """Get the state file path for the current branch."""
    sanitized_branch = re.sub(r"[^a-zA-Z0-9\-_]", "-", branch)
    return os.environ.get(
        "STATE_PATH", f".augment-index-state/{sanitized_branch}/state.json"
    )


def main() -> None:
    """Main function."""
    print("GitHub Action Indexer - Starting...")

    try:
        # Load configuration
        config = load_config()
        state_path = get_state_path(config.branch)

        print(f"Repository: {config.owner}/{config.repo}")
        print(f"Branch: {config.branch}")
        print(f"Commit ref: {config.currentCommit}")
        print(f"State path: {state_path}")

        # Create DirectContext
        context = DirectContext.create(api_key=config.apiToken, api_url=config.apiUrl)

        # Create index manager and resolve commit SHA
        manager = IndexManager(context, config, state_path)
        manager.resolve_commit_sha()

        print(f"Resolved commit SHA: {config.currentCommit}")

        # Perform indexing
        result = manager.index()

        # Print results
        print("\n=== Indexing Results ===")
        print(f"Success: {result.success}")
        print(f"Type: {result.type}")
        print(f"Files Indexed: {result.filesIndexed}")
        print(f"Files Deleted: {result.filesDeleted}")
        print(f"Checkpoint ID: {result.checkpointId}")
        print(f"Commit SHA: {result.commitSha}")

        if result.reindexReason:
            print(f"Re-index Reason: {result.reindexReason}")

        if result.error:
            print(f"Error: {result.error}", file=sys.stderr)
            sys.exit(1)

        # Set GitHub Actions output
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            output_lines = [
                f"success={result.success}",
                f"type={result.type}",
                f"files_indexed={result.filesIndexed}",
                f"files_deleted={result.filesDeleted}",
                f"checkpoint_id={result.checkpointId}",
                f"commit_sha={result.commitSha}",
            ]
            with open(github_output, "a") as f:
                f.write("\n".join(output_lines) + "\n")

        print("\nIndexing completed successfully!")

    except Exception as error:
        print(f"Fatal error: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

