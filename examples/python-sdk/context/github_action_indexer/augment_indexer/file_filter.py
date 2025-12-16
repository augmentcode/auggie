"""
File filtering logic for GitHub repository indexing.
"""

import re
from pathlib import Path
from typing import Optional

# Keyish pattern regex - matches files that likely contain secrets/keys
KEYISH_PATTERN = re.compile(
    r'^(\.git|.*\.pem|.*\.key|.*\.pfx|.*\.p12|.*\.jks|.*\.keystore|.*\.pkcs12|.*\.crt|.*\.cer|id_rsa|id_ed25519|id_ecdsa|id_dsa)$'
)

# Default max file size in bytes (1 MB)
DEFAULT_MAX_FILE_SIZE = 1024 * 1024  # 1 MB


def always_ignore_path(path: str) -> bool:
    """
    Check if a path should always be ignored (security measure).

    Args:
        path: The file path to check.

    Returns:
        True if the path contains ".." and should be ignored.
    """
    return ".." in path


def is_keyish_path(path: str) -> bool:
    """
    Check if a path matches the keyish pattern (secrets/keys).

    Args:
        path: The file path to check.

    Returns:
        True if the filename matches patterns for secret/key files.
    """
    # Extract filename from path
    filename = Path(path).name
    return bool(KEYISH_PATTERN.match(filename))


def is_valid_file_size(size_bytes: int, max_file_size: int = DEFAULT_MAX_FILE_SIZE) -> bool:
    """
    Check if file size is valid for upload.

    Args:
        size_bytes: The size of the file in bytes.
        max_file_size: Maximum allowed file size in bytes. Defaults to 1 MB.

    Returns:
        True if the file size is within the allowed limit.
    """
    return size_bytes <= max_file_size


def is_valid_utf8(content: bytes) -> bool:
    """
    Check if file content is valid UTF-8 (not binary).

    Args:
        content: The file content as bytes.

    Returns:
        True if the content is valid UTF-8, False if it's binary or invalid.
    """
    try:
        content.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


def should_filter_file(
    path: str,
    content: bytes,
    max_file_size: Optional[int] = None,
) -> dict:
    """
    Check if a file should be filtered out.

    Returns {"filtered": True, "reason": "..."} if file should be skipped.
    Returns {"filtered": False} if file should be included.

    Priority order (from file-filtering.md):
        1. Path validation (contains "..")
        2. File size check
        3. .augmentignore rules (checked by caller)
        4. Keyish patterns
        5. .gitignore rules (checked by caller)
        6. UTF-8 validation

    Args:
        path: The file path to check.
        content: The file content as bytes.
        max_file_size: Maximum allowed file size in bytes. Defaults to DEFAULT_MAX_FILE_SIZE.

    Returns:
        A dict with "filtered" (bool) and optionally "reason" (str) keys.
    """
    effective_max_size = max_file_size if max_file_size is not None else DEFAULT_MAX_FILE_SIZE

    # 1. Check for ".." in path (security)
    if always_ignore_path(path):
        return {"filtered": True, "reason": "path_contains_dotdot"}

    # 2. Check file size
    if not is_valid_file_size(len(content), effective_max_size):
        return {"filtered": True, "reason": f"file_too_large ({len(content)} bytes)"}

    # 3. Check keyish patterns (secrets/keys)
    if is_keyish_path(path):
        return {"filtered": True, "reason": "keyish_pattern"}

    # 4. Check UTF-8 validity (binary detection)
    if not is_valid_utf8(content):
        return {"filtered": True, "reason": "binary_file"}

    return {"filtered": False}

