#!/usr/bin/env python3
"""
GitHub Action Indexer - CLI entry point

Usage:
    python -m github_action_indexer install /path/to/repo
    python -m github_action_indexer index
    python -m github_action_indexer search "query"
    python -m github_action_indexer search "query" --max-chars 5000
"""

import sys


def main() -> None:
    """CLI dispatcher for github_action_indexer commands."""
    if len(sys.argv) < 2:
        print("GitHub Action Indexer - Index GitHub repositories with incremental updates")
        print()
        print("Usage:")
        print("  python -m github_action_indexer <command> [args]")
        print()
        print("Commands:")
        print("  install [target_dir]     Install the indexer into a repository")
        print("  index                    Index the repository (uses environment variables)")
        print("  search <query>           Search the indexed repository")
        print()
        print("Examples:")
        print("  python -m github_action_indexer install /path/to/your/repo")
        print("  python -m github_action_indexer index")
        print('  python -m github_action_indexer search "authentication functions"')
        print('  python -m github_action_indexer search "error handling" --max-chars 5000')
        sys.exit(1)

    command = sys.argv[1]
    # Remove the command from argv so subcommands see correct args
    sys.argv = [sys.argv[0]] + sys.argv[2:]

    if command == "install":
        from .install import main as install_main

        install_main()
    elif command == "index":
        from .augment_indexer.main import main as index_main

        index_main()
    elif command == "search":
        from .augment_indexer.search import main as search_main

        search_main()
    else:
        print(f"Unknown command: {command}")
        print("Available commands: install, index, search")
        sys.exit(1)


if __name__ == "__main__":
    main()

