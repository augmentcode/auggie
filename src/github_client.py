"""
GitHub API client for fetching repository data.
"""

import io
import tarfile

import pathspec
import requests
from github import Github
from github.GithubException import GithubException

from .file_filter import should_filter_file
from .models import FileChange


class GitHubClient:
    """GitHub API client for fetching repository data."""

    def __init__(self, token: str) -> None:
        """
        Initialize the GitHub client with an authentication token.

        Args:
            token: GitHub personal access token or GitHub App token.
        """
        self._github = Github(token)
        self._token = token

    def resolve_ref(self, owner: str, repo: str, ref: str) -> str:
        """
        Resolve a ref (like "HEAD", "main", or a commit SHA) to a commit SHA.

        Args:
            owner: Repository owner.
            repo: Repository name.
            ref: Git ref to resolve.

        Returns:
            The full 40-character commit SHA.

        Raises:
            Exception: If the ref cannot be resolved.
        """
        try:
            repository = self._github.get_repo(f"{owner}/{repo}")
            commit = repository.get_commit(ref)
            return commit.sha
        except GithubException as error:
            raise Exception(
                f'Failed to resolve ref "{ref}" for {owner}/{repo}: {error}'
            ) from error

    def download_tarball(self, owner: str, repo: str, ref: str) -> dict[str, str]:
        """
        Download repository as tarball and extract files.

        Args:
            owner: Repository owner.
            repo: Repository name.
            ref: Git ref to download.

        Returns:
            Dictionary mapping file paths to their contents.
        """
        print(f"Downloading tarball for {owner}/{repo}@{ref}...")

        repository = self._github.get_repo(f"{owner}/{repo}")
        tarball_url = repository.get_archive_link("tarball", ref)

        # Download tarball (10 minute timeout to handle large repositories)
        # Include auth header for private repos
        headers = {"Authorization": f"Bearer {self._token}"}
        response = requests.get(tarball_url, headers=headers, stream=True, timeout=600)
        if not response.ok:
            raise Exception(f"Failed to download tarball: {response.reason}")

        # Load ignore patterns
        augmentignore, gitignore = self._load_ignore_patterns(owner, repo, ref)

        # Track filtering statistics
        files: dict[str, str] = {}
        total_files = 0
        filtered_files = 0
        filter_reasons: dict[str, int] = {}

        # Extract files from tarball
        tarball_data = io.BytesIO(response.content)
        with tarfile.open(fileobj=tarball_data, mode="r:gz") as tar:
            for member in tar.getmembers():
                # Skip directories and symlinks
                if not member.isfile():
                    continue

                total_files += 1

                # Remove the root directory prefix (e.g., "owner-repo-sha/")
                path_parts = member.name.split("/")
                path_parts.pop(0)  # Remove first component
                file_path = "/".join(path_parts)

                if not file_path:
                    continue

                # Read file contents
                file_obj = tar.extractfile(member)
                if file_obj is None:
                    continue
                content_bytes = file_obj.read()

                # Apply filtering in priority order:
                # 1. .augmentignore
                if augmentignore and augmentignore.match_file(file_path):
                    filtered_files += 1
                    filter_reasons["augmentignore"] = filter_reasons.get("augmentignore", 0) + 1
                    continue

                # 2. Path validation, file size, keyish patterns, UTF-8 validation
                filter_result = should_filter_file(path=file_path, content=content_bytes)

                if filter_result["filtered"]:
                    filtered_files += 1
                    reason = filter_result.get("reason", "unknown")
                    filter_reasons[reason] = filter_reasons.get(reason, 0) + 1
                    continue

                # 3. .gitignore (checked last)
                if gitignore and gitignore.match_file(file_path):
                    filtered_files += 1
                    filter_reasons["gitignore"] = filter_reasons.get("gitignore", 0) + 1
                    continue

                # File passed all filters
                try:
                    contents = content_bytes.decode("utf-8")
                    files[file_path] = contents
                except UnicodeDecodeError:
                    # This should not happen if is_valid_utf8() is working correctly
                    filtered_files += 1
                    filter_reasons["decode_error"] = filter_reasons.get("decode_error", 0) + 1
                    print(f"Warning: File {file_path} passed UTF-8 validation but failed to decode")

        print(f"Extracted {len(files)} files from tarball")
        print(f"Filtered {filtered_files} of {total_files} files. Reasons: {filter_reasons}")
        return files

    def compare_commits(
        self, owner: str, repo: str, base: str, head: str
    ) -> dict:
        """
        Compare two commits and get file changes.
        """
        print(f"Comparing {base}...{head}...")

        repository = self._github.get_repo(f"{owner}/{repo}")
        comparison = repository.compare(base, head)

        files: list[FileChange] = []

        for file in comparison.files:
            change = FileChange(
                path=file.filename,
                status=self._map_github_status(file.status),
                previousFilename=file.previous_filename,
            )

            # Download file contents for added/modified files
            if change.status in ("added", "modified"):
                try:
                    contents = self.get_file_contents(owner, repo, file.filename, head)
                    change.contents = contents
                except Exception as error:
                    print(f"Warning: Failed to download {file.filename}: {error}")

            files.append(change)

        return {
            "files": files,
            "commits": comparison.total_commits,
            "totalChanges": len(comparison.files),
        }

    def get_file_contents(
        self, owner: str, repo: str, path: str, ref: str
    ) -> str:
        """
        Get file contents at a specific ref.

        Args:
            owner: Repository owner.
            repo: Repository name.
            path: File path within the repository.
            ref: Git ref to get contents at.

        Returns:
            The file contents as a string.

        Raises:
            Exception: If the path is not a file.
        """
        repository = self._github.get_repo(f"{owner}/{repo}")
        content = repository.get_contents(path, ref)

        if isinstance(content, list):
            raise Exception(f"{path} is not a file")

        return content.decoded_content.decode("utf-8")

    def _load_ignore_patterns(
        self, owner: str, repo: str, ref: str
    ) -> tuple[pathspec.PathSpec | None, pathspec.PathSpec | None]:
        """
        Load .gitignore and .augmentignore patterns separately.

        Returns both filters to maintain proper priority order:
        .augmentignore → keyish → .gitignore

        Args:
            owner: Repository owner.
            repo: Repository name.
            ref: Git ref to load patterns from.

        Returns:
            Tuple of (augmentignore, gitignore) PathSpec objects, or None if not found.
        """
        augmentignore: pathspec.PathSpec | None = None
        gitignore: pathspec.PathSpec | None = None

        # Try to load .gitignore
        try:
            gitignore_content = self.get_file_contents(owner, repo, ".gitignore", ref)
            gitignore = pathspec.PathSpec.from_lines("gitwildmatch", gitignore_content.splitlines())
        except Exception:
            # .gitignore doesn't exist
            pass

        # Try to load .augmentignore
        try:
            augmentignore_content = self.get_file_contents(owner, repo, ".augmentignore", ref)
            augmentignore = pathspec.PathSpec.from_lines("gitwildmatch", augmentignore_content.splitlines())
        except Exception:
            # .augmentignore doesn't exist
            pass

        return augmentignore, gitignore

    def _map_github_status(self, status: str) -> str:
        """
        Map GitHub file status to our FileChange status.

        Args:
            status: GitHub file status string.

        Returns:
            Normalized status string.
        """
        status_map = {
            "added": "added",
            "modified": "modified",
            "removed": "removed",
            "renamed": "renamed",
        }
        return status_map.get(status, "modified")

    def ignore_files_changed(
        self, owner: str, repo: str, base: str, head: str
    ) -> bool:
        """
        Check if ignore files changed between commits.

        Args:
            owner: Repository owner.
            repo: Repository name.
            base: Base commit SHA.
            head: Head commit SHA.

        Returns:
            True if .gitignore or .augmentignore changed, False otherwise.
        """
        repository = self._github.get_repo(f"{owner}/{repo}")
        comparison = repository.compare(base, head)

        ignore_files = [".gitignore", ".augmentignore"]
        return any(file.filename in ignore_files for file in comparison.files)

    def is_force_push(
        self, owner: str, repo: str, base: str, head: str
    ) -> bool:
        """
        Check if the push was a force push.

        Args:
            owner: Repository owner.
            repo: Repository name.
            base: Base commit SHA.
            head: Head commit SHA.

        Returns:
            True if the push was a force push, False otherwise.
        """
        try:
            repository = self._github.get_repo(f"{owner}/{repo}")
            repository.compare(base, head)
            return False
        except GithubException:
            # If comparison fails, it's likely a force push
            return True
