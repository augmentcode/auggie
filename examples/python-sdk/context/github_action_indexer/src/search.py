#!/usr/bin/env python3
"""
CLI tool to search the indexed repository

Usage (from example root directory):
    python src/search.py "your search query"
    python src/search.py "your search query" --max-chars 5000
"""

import argparse
import json
import os
import re
import sys
import tempfile
from typing import Optional

from auggie_sdk.context import DirectContext

from models import IndexState


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
            print("  python -m examples.context.github_action_indexer.main", file=sys.stderr)
            sys.exit(1)

        # Create a temporary file with the context state for import
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", prefix="github-indexer-state-", delete=False
        ) as temp_file:
            temp_state_file = temp_file.name
            json.dump(state["contextState"], temp_file, indent=2)

        try:
            # Import state using DirectContext.import_from_file
            context = DirectContext.import_from_file(
                temp_state_file, api_key=api_token, api_url=api_url
            )
        finally:
            # Clean up temporary file
            os.unlink(temp_state_file)

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

