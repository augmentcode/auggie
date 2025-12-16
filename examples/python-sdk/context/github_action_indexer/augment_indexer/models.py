"""
Types for the GitHub Action Indexer

This module defines the data types used by the GitHub Action Indexer
for tracking index state, file changes, configuration, and results.
"""

from dataclasses import dataclass
from typing import Literal, Optional

from typing_extensions import TypedDict

from auggie_sdk.context.models import DirectContextState


class RepositoryInfo(TypedDict):
    """Repository information for index state."""

    owner: str  # Repository owner
    name: str  # Repository name


class IndexState(TypedDict):
    """
    Persistent state for the GitHub Action Indexer.

    This state is stored between indexing runs to enable incremental indexing.
    """

    contextState: DirectContextState
    """DirectContext state (checkpoint, blobs, etc.)"""

    lastCommitSha: str
    """Last indexed commit SHA (must be a full 40-character SHA, not a ref like 'HEAD')"""

    repository: RepositoryInfo
    """Repository information - used to verify we're indexing the same repository"""


@dataclass
class FileChange:
    """
    Represents a file change detected between commits.

    Used to track what files need to be indexed or removed from the index.
    """

    path: str
    """File path"""

    status: Literal["added", "modified", "removed", "renamed"]
    """Change status: added, modified, removed, renamed"""

    previousFilename: Optional[str] = None
    """Previous filename (for renames)"""

    contents: Optional[str] = None
    """File contents (for added/modified files)"""

    oldBlobName: Optional[str] = None
    """Blob name from previous index (for modified/removed files)"""


@dataclass
class IndexConfig:
    """
    Configuration for the GitHub Action Indexer.

    Contains all the settings needed to perform indexing of a GitHub repository.
    """

    apiToken: str
    """Augment API token"""

    apiUrl: str
    """Augment API URL (provided via AUGMENT_API_URL env var)"""

    githubToken: str
    """GitHub token"""

    owner: str
    """Repository owner"""

    repo: str
    """Repository name"""

    branch: str
    """Branch to index"""

    currentCommit: str
    """Current commit SHA"""

    maxCommits: Optional[int] = None
    """Maximum commits before full re-index"""

    maxFiles: Optional[int] = None
    """Maximum file changes before full re-index"""


@dataclass
class IndexResult:
    """
    Result from an indexing operation.

    Contains information about what was indexed and whether it was successful.
    """

    success: bool
    """Whether indexing was successful"""

    type: Literal["full", "incremental", "no-changes"]
    """Type of indexing performed"""

    filesIndexed: int
    """Number of files indexed"""

    filesDeleted: int
    """Number of files deleted"""

    checkpointId: str
    """New checkpoint ID"""

    commitSha: str
    """Commit SHA that was indexed"""

    error: Optional[str] = None
    """Error message if failed"""

    reindexReason: Optional[str] = None
    """Reason for full re-index (if applicable)"""

