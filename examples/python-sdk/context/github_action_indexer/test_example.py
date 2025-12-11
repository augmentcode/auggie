#!/usr/bin/env python3
"""
Local tests for the github_action_indexer example.

This example requires GitHub credentials and environment variables to run
the full indexing flow. However, we can test:
1. Module imports work correctly
2. File filtering logic works correctly
3. Model definitions are valid

The full integration test would need:
- AUGMENT_API_TOKEN, AUGMENT_API_URL
- GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA

Usage:
    cd examples/python-sdk/context
    python -m pytest github_action_indexer/test_example.py
    # or
    python github_action_indexer/test_example.py
"""

import subprocess
import sys
from pathlib import Path


def test_imports():
    """Test that all modules can be imported via module execution."""
    print("Testing imports...")

    # Run a quick import check via module execution
    context_dir = Path(__file__).parent.parent
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
from github_action_indexer.augment_indexer.file_filter import (
    always_ignore_path,
    is_keyish_path,
    is_valid_file_size,
    is_valid_utf8,
    should_filter_file,
)
print("  ✓ file_filter")

from github_action_indexer.augment_indexer.models import (
    FileChange,
    IndexConfig,
    IndexResult,
    IndexState,
    RepositoryInfo,
)
print("  ✓ models")

from github_action_indexer.augment_indexer.github_client import GitHubClient
print("  ✓ github_client")

from github_action_indexer.augment_indexer.index_manager import IndexManager
print("  ✓ index_manager")

print("All imports successful!")
""",
        ],
        cwd=str(context_dir),
        capture_output=True,
        text=True,
    )

    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if result.returncode != 0:
        print("❌ Import test failed")
        sys.exit(1)


def test_file_filter():
    """Test file filtering logic."""
    print("\nTesting file_filter logic...")

    context_dir = Path(__file__).parent.parent
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
from github_action_indexer.augment_indexer.file_filter import (
    always_ignore_path,
    is_keyish_path,
    is_valid_file_size,
    is_valid_utf8,
    should_filter_file,
)

# Test always_ignore_path
assert always_ignore_path("../etc/passwd") is True
assert always_ignore_path("foo/../bar") is True
assert always_ignore_path("foo/bar/baz.py") is False
print("  ✓ always_ignore_path")

# Test is_keyish_path
assert is_keyish_path("secrets/private.key") is True
assert is_keyish_path("certs/server.pem") is True
assert is_keyish_path("keys/id_rsa") is True
assert is_keyish_path("src/main.py") is False
assert is_keyish_path("docs/readme.md") is False
print("  ✓ is_keyish_path")

# Test is_valid_file_size
assert is_valid_file_size(1000) is True
assert is_valid_file_size(1024 * 1024) is True  # Exactly 1 MB
assert is_valid_file_size(1024 * 1024 + 1) is False  # Over 1 MB
print("  ✓ is_valid_file_size")

# Test is_valid_utf8
assert is_valid_utf8(b"Hello, world!") is True
assert is_valid_utf8("Hello, 世界!".encode("utf-8")) is True
assert is_valid_utf8(b"\\xff\\xfe") is False  # Invalid UTF-8 sequence
assert is_valid_utf8(b"\\x80\\x81\\x82") is False  # Invalid UTF-8 (continuation bytes without start)
print("  ✓ is_valid_utf8")

# Test should_filter_file
result = should_filter_file("src/main.py", b"print('hello')")
assert result["filtered"] is False

result = should_filter_file("../etc/passwd", b"root:x:0:0")
assert result["filtered"] is True
assert result["reason"] == "path_contains_dotdot"

result = should_filter_file("secrets/key.pem", b"-----BEGIN RSA PRIVATE KEY-----")
assert result["filtered"] is True
assert result["reason"] == "keyish_pattern"

result = should_filter_file("image.png", b"\\x89PNG\\r\\n\\x1a\\n")
assert result["filtered"] is True
assert "binary" in result["reason"]

print("  ✓ should_filter_file")

print("All file_filter tests passed!")
""",
        ],
        cwd=str(context_dir),
        capture_output=True,
        text=True,
    )

    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if result.returncode != 0:
        print("❌ File filter test failed")
        sys.exit(1)


def test_models():
    """Test model definitions."""
    print("\nTesting models...")

    context_dir = Path(__file__).parent.parent
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
from github_action_indexer.augment_indexer.models import FileChange, IndexConfig, IndexResult

# Test FileChange
change = FileChange(path="src/main.py", status="added", contents="print('hello')")
assert change.path == "src/main.py"
assert change.status == "added"
print("  ✓ FileChange")

# Test IndexConfig
config = IndexConfig(
    apiToken="token",
    apiUrl="https://api.example.com",
    githubToken="gh_token",
    owner="owner",
    repo="repo",
    branch="main",
    currentCommit="abc123",
)
assert config.owner == "owner"
assert config.repo == "repo"
print("  ✓ IndexConfig")

# Test IndexResult
result = IndexResult(
    success=True,
    type="full",
    filesIndexed=10,
    filesDeleted=0,
    checkpointId="cp_123",
    commitSha="abc123",
)
assert result.success is True
assert result.filesIndexed == 10
print("  ✓ IndexResult")

print("All model tests passed!")
""",
        ],
        cwd=str(context_dir),
        capture_output=True,
        text=True,
    )

    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if result.returncode != 0:
        print("❌ Model test failed")
        sys.exit(1)


def main():
    """Run all tests."""
    print("=" * 50)
    print("GitHub Action Indexer - Local Tests")
    print("=" * 50)

    test_imports()
    test_file_filter()
    test_models()

    print("\n" + "=" * 50)
    print("✅ All tests passed!")
    print("=" * 50)


if __name__ == "__main__":
    main()

