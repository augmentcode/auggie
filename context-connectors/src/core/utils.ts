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

