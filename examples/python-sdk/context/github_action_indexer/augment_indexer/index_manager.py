"""
Index Manager - Core indexing logic
"""

import json
import tempfile
from pathlib import Path
from typing import Optional

from auggie_sdk.context import DirectContext, File

from .github_client import GitHubClient
from .models import FileChange, IndexConfig, IndexResult, IndexState, RepositoryInfo

DEFAULT_MAX_COMMITS = 100
DEFAULT_MAX_FILES = 500


class IndexManager:
    """Index Manager - Core indexing logic for GitHub repositories."""

    def __init__(
        self, context: DirectContext, config: IndexConfig, state_path: str
    ) -> None:
        """
        Initialize the IndexManager.

        Args:
            context: DirectContext instance for indexing operations.
            config: Configuration for the indexing operation.
            state_path: Path to the state file for persistence.
        """
        self._context = context
        self._config = config
        self._state_path = state_path
        self._github = GitHubClient(config.githubToken)

    def resolve_commit_sha(self) -> None:
        """
        Resolve the current commit ref to an actual commit SHA.

        This handles cases where GITHUB_SHA might be "HEAD" or a branch name.
        Updates the config.currentCommit with the resolved SHA.
        """
        resolved_sha = self._github.resolve_ref(
            self._config.owner, self._config.repo, self._config.currentCommit
        )
        self._config.currentCommit = resolved_sha

    def _load_state(self) -> Optional[IndexState]:
        """
        Load index state from file system.

        EXTENDING TO OTHER STORAGE BACKENDS:
        Replace this method to load state from your preferred storage:
        - Redis: Use redis-py client to GET the state JSON
        - S3: Use boto3 to get_object from S3 bucket
        - Database: Query your database for the state record

        Example for Redis:
            import redis
            r = redis.Redis.from_url(redis_url)
            data = r.get(state_key)
            return json.loads(data) if data else None

        Example for S3:
            import boto3
            s3 = boto3.client('s3')
            response = s3.get_object(Bucket=bucket, Key=key)
            data = response['Body'].read().decode('utf-8')
            return json.loads(data)

        Returns:
            The loaded IndexState or None if the file doesn't exist.
        """
        try:
            with open(self._state_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return None

    def _save_state(self, state: IndexState) -> None:
        """
        Save index state to file system.

        EXTENDING TO OTHER STORAGE BACKENDS:
        Replace this method to save state to your preferred storage:
        - Redis: Use redis-py client to SET the state JSON
        - S3: Use boto3 to put_object to S3 bucket
        - Database: Insert or update the state record in your database

        Example for Redis:
            import redis
            r = redis.Redis.from_url(redis_url)
            r.set(state_key, json.dumps(state))

        Example for S3:
            import boto3
            s3 = boto3.client('s3')
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=json.dumps(state),
                ContentType='application/json'
            )

        Note: The state is just a JSON object (IndexState type) that can be
        serialized and stored anywhere. For distributed systems, consider using
        Redis or a database for shared state across multiple workers.

        Args:
            state: The IndexState to save.
        """
        # Ensure directory exists
        Path(self._state_path).parent.mkdir(parents=True, exist_ok=True)

        # Write state to file
        with open(self._state_path, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)

    def index(self) -> IndexResult:
        """
        Main indexing entry point.

        Returns:
            IndexResult with success status and indexing details.
        """
        print(
            f"Starting index for {self._config.owner}/{self._config.repo}"
            f"@{self._config.branch}"
        )

        try:
            # Load previous state
            previous_state = self._load_state()

            # If we have previous state, we'll need to create a new context with the imported state
            # For now, we'll handle this in the incremental update logic

            # Determine if we need full re-index
            should_reindex, reason = self._should_full_reindex(previous_state)

            if should_reindex:
                return self._full_reindex(reason)

            # Perform incremental update
            # previous_state is guaranteed to be non-null here
            if not previous_state:
                raise RuntimeError("previous_state should not be None at this point")
            return self._incremental_update(previous_state)
        except Exception as error:
            print(f"Indexing failed: {error}")
            return IndexResult(
                success=False,
                type="full",
                filesIndexed=0,
                filesDeleted=0,
                checkpointId="",
                commitSha=self._config.currentCommit,
                error=str(error),
            )

    def _should_full_reindex(
        self, previous_state: Optional[IndexState]
    ) -> tuple[bool, Optional[str]]:
        """
        Determine if full re-index is needed.

        Args:
            previous_state: The previous index state, or None if first run.

        Returns:
            Tuple of (should_reindex, reason).
        """
        # No previous state - first run
        if not previous_state:
            return (True, "first_run")

        # Different repository
        if (
            previous_state["repository"]["owner"] != self._config.owner
            or previous_state["repository"]["name"] != self._config.repo
        ):
            return (True, "different_repository")

        # Same commit - no changes
        if previous_state["lastCommitSha"] == self._config.currentCommit:
            print("No changes detected")
            return (False, None)

        # Check for force push
        is_force_push = self._github.is_force_push(
            self._config.owner,
            self._config.repo,
            previous_state["lastCommitSha"],
            self._config.currentCommit,
        )

        if is_force_push:
            return (True, "force_push")

        # Get comparison
        comparison = self._github.compare_commits(
            self._config.owner,
            self._config.repo,
            previous_state["lastCommitSha"],
            self._config.currentCommit,
        )

        # Too many commits
        max_commits = self._config.maxCommits or DEFAULT_MAX_COMMITS
        if comparison["commits"] > max_commits:
            return (
                True,
                f"too_many_commits ({comparison['commits']} > {max_commits})",
            )

        # Too many file changes
        max_files = self._config.maxFiles or DEFAULT_MAX_FILES
        if comparison["totalChanges"] > max_files:
            return (
                True,
                f"too_many_files ({comparison['totalChanges']} > {max_files})",
            )

        # Check if ignore files changed
        ignore_changed = self._github.ignore_files_changed(
            self._config.owner,
            self._config.repo,
            previous_state["lastCommitSha"],
            self._config.currentCommit,
        )

        if ignore_changed:
            return (True, "ignore_files_changed")

        return (False, None)

    def _full_reindex(self, reason: Optional[str]) -> IndexResult:
        """
        Perform full repository re-index.

        Args:
            reason: The reason for the full re-index.

        Returns:
            IndexResult with the result of the full re-index.
        """
        print(f"Performing full re-index (reason: {reason or 'unknown'})")

        # Download entire repository as tarball
        files = self._github.download_tarball(
            self._config.owner, self._config.repo, self._config.currentCommit
        )

        # Add all files to index
        files_to_index = [
            File(path=path, contents=contents) for path, contents in files.items()
        ]

        print(f"Adding {len(files_to_index)} files to index...")
        self._context.add_to_index(files_to_index)

        # Export DirectContext state
        context_state = self._context.export()
        context_state_dict = context_state.to_dict()

        new_state: IndexState = {
            "contextState": context_state_dict,
            "lastCommitSha": self._config.currentCommit,
            "repository": RepositoryInfo(
                owner=self._config.owner,
                name=self._config.repo,
            ),
        }

        # Save state
        self._save_state(new_state)

        return IndexResult(
            success=True,
            type="full",
            filesIndexed=len(files_to_index),
            filesDeleted=0,
            checkpointId=context_state.checkpoint_id or "",
            commitSha=self._config.currentCommit,
            reindexReason=reason,
        )

    def _incremental_update(self, previous_state: IndexState) -> IndexResult:
        """
        Perform incremental update.

        Args:
            previous_state: The previous index state.

        Returns:
            IndexResult with the result of the incremental update.
        """
        print("Performing incremental update...")

        # Create a temporary file with the previous context state
        # Use delete=False because Windows can't reopen a NamedTemporaryFile while it's open
        temp_file = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", prefix="github-indexer-incremental-", delete=False
        )
        temp_path = Path(temp_file.name)
        try:
            json.dump(previous_state["contextState"], temp_file, indent=2)
            temp_file.close()  # Close before reading on Windows

            # Create a new context from the previous state
            self._context = DirectContext.import_from_file(
                str(temp_path),
                api_key=self._config.apiToken,
                api_url=self._config.apiUrl,
            )
        finally:
            temp_path.unlink(missing_ok=True)

        # Get file changes
        comparison = self._github.compare_commits(
            self._config.owner,
            self._config.repo,
            previous_state["lastCommitSha"],
            self._config.currentCommit,
        )

        # Process changes
        files_to_add, files_to_delete = self._process_file_changes(comparison["files"])

        print(f"Adding {len(files_to_add)} files, deleting {len(files_to_delete)} files")

        # Update index
        if files_to_add:
            self._context.add_to_index(files_to_add)

        if files_to_delete:
            self._context.remove_from_index(files_to_delete)

        # Export DirectContext state
        context_state = self._context.export()
        context_state_dict = context_state.to_dict()

        new_state: IndexState = {
            "contextState": context_state_dict,
            "lastCommitSha": self._config.currentCommit,
            "repository": previous_state["repository"],
        }

        # Save state
        self._save_state(new_state)

        return IndexResult(
            success=True,
            type="incremental",
            filesIndexed=len(files_to_add),
            filesDeleted=len(files_to_delete),
            checkpointId=context_state.checkpoint_id or "",
            commitSha=self._config.currentCommit,
        )

    def _process_file_changes(
        self, changes: list[FileChange]
    ) -> tuple[list[File], list[str]]:
        """
        Process file changes and categorize them for indexing.

        Args:
            changes: List of file changes from the comparison.

        Returns:
            Tuple of (files_to_add, files_to_delete).
        """
        files_to_add: list[File] = []
        files_to_delete: list[str] = []

        for change in changes:
            if change.status in ("added", "modified"):
                if change.contents:
                    files_to_add.append(
                        File(path=change.path, contents=change.contents)
                    )
            elif change.status == "removed":
                files_to_delete.append(change.path)
            elif change.status == "renamed":
                if change.previousFilename:
                    files_to_delete.append(change.previousFilename)
                if change.contents:
                    files_to_add.append(
                        File(path=change.path, contents=change.contents)
                    )

        return files_to_add, files_to_delete

