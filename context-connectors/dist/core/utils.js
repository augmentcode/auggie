/**
 * Shared utility functions
 */
/**
 * Sanitize a key for use in filenames/paths.
 * Replaces unsafe characters with underscores.
 */
export function sanitizeKey(key) {
    return key
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/__+/g, "_")
        .replace(/^_+|_+$/g, "");
}
/**
 * Get current timestamp in ISO format
 */
export function isoTimestamp() {
    return new Date().toISOString();
}
//# sourceMappingURL=utils.js.map