#!/usr/bin/env python3
"""
CLI tool to search the indexed repository

Usage:
    cd examples/python-sdk/context
    python -m github_action_indexer search "your search query"
    python -m github_action_indexer search "your search query" --max-chars 5000
"""

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Optional

from auggie_sdk.context import DirectContext

from .models import IndexState


def get_state_path() -> str:
    """Get the state file path for the current branch."""
    branch = os.environ.get("BRANCH", "main")
    sanitized_branch = re.sub(r"[^a-zA-Z0-9\-_]", "-", branch)
    return os.environ.get(
        "STATE_PATH", f".augment-index-state/{sanitized_branch}/state.json"
    )


def load_state(state_path: str) -> Optional[IndexState]:
    """Load index state from file system."""
    try:
        with open(state_path, "r") as f:
            data = f.read()
        return json.loads(data)
    except FileNotFoundError:
        return None


def main() -> None:
    """Main search function."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Search the indexed repository",
        epilog='Example: python search.py "authentication functions"',
    )
    parser.add_argument("query", help="Search query")
    parser.add_argument(
        "--max-chars",
        type=int,
        help="Maximum number of characters in output",
        dest="max_chars",
    )
    args = parser.parse_args()

    # Get API credentials
    api_token = os.environ.get("AUGMENT_API_TOKEN")
    if not api_token:
        print("Error: AUGMENT_API_TOKEN environment variable is required", file=sys.stderr)
        sys.exit(1)

    api_url = os.environ.get("AUGMENT_API_URL")
    if not api_url:
        print(
            "Error: AUGMENT_API_URL environment variable is required. Please set it to your "
            "tenant-specific URL (e.g., 'https://your-tenant.api.augmentcode.com/')",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f'Searching for: "{args.query}"')
    if args.max_chars is not None:
        print(f"Limiting results to max {args.max_chars} characters\n")
    else:
        print()

    try:
        # Load the index state first
        state_path = get_state_path()
        print(f"Loading index state from: {state_path}")
        state = load_state(state_path)

        if not state:
            print("Error: No index state found. Run indexing first.", file=sys.stderr)
            print("  python -m github_action_indexer index", file=sys.stderr)
            sys.exit(1)

        # Create a temporary file with the context state for import
        # Use delete=False because Windows can't reopen a NamedTemporaryFile while it's open
        temp_file = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", prefix="github-indexer-state-", delete=False
        )
        temp_path = Path(temp_file.name)
        try:
            json.dump(state["contextState"], temp_file, indent=2)
            temp_file.close()  # Close before reading on Windows

            # Import state using DirectContext.import_from_file
            context = DirectContext.import_from_file(
                str(temp_path), api_key=api_token, api_url=api_url
            )
        finally:
            temp_path.unlink(missing_ok=True)

        file_count = len(state["contextState"].get("blobs", []))

        print(f"Loaded index: {file_count} files indexed")
        print(f"Repository: {state['repository']['owner']}/{state['repository']['name']}")
        print(f"Last indexed commit: {state['lastCommitSha']}\n")

        # Perform search with optional character limit
        results = context.search(args.query, max_output_length=args.max_chars)

        if not results or results.strip() == "":
            print("No results found.")
            return

        print("Search results:\n")
        print(results)

    except Exception as error:
        print(f"Search failed: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

