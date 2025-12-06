/**
 * File filtering logic for GitHub repository indexing
 * Based on services/integrations/github/processor/server/path_filter.go
 * and github_event_handler.go
 */

/**
 * Keyish pattern regex - matches files that likely contain secrets/keys
 * From path_filter.go line 24
 */
const KEYISH_PATTERN =
  /^(\.git|.*\.pem|.*\.key|.*\.pfx|.*\.p12|.*\.jks|.*\.keystore|.*\.pkcs12|.*\.crt|.*\.cer|id_rsa|id_ed25519|id_ecdsa|id_dsa)$/;

/**
 * Default max file size in bytes (1 MB)
 * From github_event_handler.go isValidFileSizeToUpload()
 */
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1 MB

/**
 * Check if a path should always be ignored (security measure)
 * From github_event_handler.go alwaysIgnorePath()
 */
export function alwaysIgnorePath(path: string): boolean {
  return path.includes("..");
}

/**
 * Check if a path matches the keyish pattern (secrets/keys)
 * From path_filter.go
 */
export function isKeyishPath(path: string): boolean {
  // Extract filename from path
  const filename = path.split("/").pop() || "";
  return KEYISH_PATTERN.test(filename);
}

/**
 * Check if file size is valid for upload
 * From github_event_handler.go isValidFileSizeToUpload()
 */
export function isValidFileSize(
  sizeBytes: number,
  maxFileSize = DEFAULT_MAX_FILE_SIZE
): boolean {
  return sizeBytes <= maxFileSize;
}

/**
 * Check if file content is valid UTF-8 (not binary)
 * From github_event_handler.go isValidFileToUpload()
 */
export function isValidUtf8(content: Buffer): boolean {
  try {
    // Try to decode as UTF-8
    const decoded = content.toString("utf-8");
    // Re-encode and compare to detect invalid UTF-8
    const reencoded = Buffer.from(decoded, "utf-8");
    return content.equals(reencoded);
  } catch {
    return false;
  }
}

/**
 * Check if a file should be filtered out
 * Returns { filtered: true, reason: string } if file should be skipped
 * Returns { filtered: false } if file should be included
 *
 * Priority order (from file-filtering.md):
 * 1. Path validation (contains "..")
 * 2. File size check
 * 3. .augmentignore rules (checked by caller)
 * 4. Keyish patterns
 * 5. .gitignore rules (checked by caller)
 * 6. UTF-8 validation
 */
export function shouldFilterFile(params: {
  path: string;
  content: Buffer;
  maxFileSize?: number;
}): { filtered: boolean; reason?: string } {
  const { path, content, maxFileSize } = params;

  // 1. Check for ".." in path (security)
  if (alwaysIgnorePath(path)) {
    return { filtered: true, reason: "path_contains_dotdot" };
  }

  // 2. Check file size
  if (!isValidFileSize(content.length, maxFileSize)) {
    return {
      filtered: true,
      reason: `file_too_large (${content.length} bytes)`,
    };
  }

  // 3. Check keyish patterns (secrets/keys)
  if (isKeyishPath(path)) {
    return { filtered: true, reason: "keyish_pattern" };
  }

  // 4. Check UTF-8 validity (binary detection)
  if (!isValidUtf8(content)) {
    return { filtered: true, reason: "binary_file" };
  }

  return { filtered: false };
}
