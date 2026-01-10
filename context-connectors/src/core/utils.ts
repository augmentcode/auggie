/**
 * Shared utility functions
 */

/**
 * Sanitize a key for use in filenames/paths.
 * Replaces unsafe characters with underscores.
 */
export function sanitizeKey(key: string): string {
  return key
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Get current timestamp in ISO format
 */
export function isoTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Normalize a directory/file path for use with Source APIs.
 *
 * - Removes leading "./" prefix
 * - Removes leading "/" prefix
 * - Removes trailing "/" suffix
 * - Collapses multiple consecutive slashes
 * - Returns "" for root directory representations
 *
 * @example
 * normalizePath("./src")    // "src"
 * normalizePath("/src/")    // "src"
 * normalizePath("src//lib") // "src/lib"
 * normalizePath("./")       // ""
 * normalizePath("/")        // ""
 */
export function normalizePath(path: string): string {
  return path
    .replace(/^\.\//, "") // Remove leading ./
    .replace(/^\/+/, "") // Remove leading slashes
    .replace(/\/+$/, "") // Remove trailing slashes
    .replace(/\/\/+/g, "/"); // Collapse multiple slashes
}

