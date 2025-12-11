#!/usr/bin/env python3
"""
Test for the filesystem_context example.

This example runs synchronously and tests the FileSystemContext API for:
- Creating an MCP-based context
- Searching a local directory
- Using search_and_ask for Q&A and code review
- Properly closing the MCP connection
"""

import subprocess
import sys
from pathlib import Path


def main():
    """Run the filesystem_context example and verify it completes successfully."""
    # Get the package directory and run from parent so module execution works
    package_dir = Path(__file__).parent
    context_dir = package_dir.parent

    print("Running: python -m filesystem_context")
    print(f"Working directory: {context_dir}")

    result = subprocess.run(
        [sys.executable, "-m", "filesystem_context"],
        capture_output=True,
        text=True,
        timeout=120,  # 2 minutes should be plenty
        cwd=str(context_dir),
    )

    # Print output for debugging
    if result.stdout:
        print("=== stdout ===")
        print(result.stdout)
    if result.stderr:
        print("=== stderr ===")
        print(result.stderr)

    # Verify success
    if result.returncode != 0:
        print(f"❌ Example failed with exit code {result.returncode}")
        sys.exit(1)

    # Verify expected output
    if "=== Sample Complete ===" not in result.stdout:
        print("❌ Example did not complete successfully (missing completion message)")
        sys.exit(1)

    if "MCP connection closed" not in result.stdout:
        print("❌ Example did not properly close MCP connection")
        sys.exit(1)

    print("✅ filesystem_context example passed")


if __name__ == "__main__":
    main()

