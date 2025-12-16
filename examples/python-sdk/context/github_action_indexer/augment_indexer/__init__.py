"""
GitHub Action Repository Indexer

A Python example showing how to index a GitHub repository using the Augment SDK
Direct Mode with incremental updates.

See README.md for usage instructions.
"""

from .models import FileChange, IndexConfig, IndexResult, IndexState
from .file_filter import should_filter_file
from .github_client import GitHubClient
from .index_manager import IndexManager

__all__ = [
    "FileChange",
    "IndexConfig", 
    "IndexResult",
    "IndexState",
    "should_filter_file",
    "GitHubClient",
    "IndexManager",
]

