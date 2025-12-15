/**
 * File filtering logic for repository indexing
 */
/**
 * Default max file size in bytes (1 MB)
 */
export declare const DEFAULT_MAX_FILE_SIZE: number;
/**
 * Check if a path should always be ignored (security measure)
 */
export declare function alwaysIgnorePath(path: string): boolean;
/**
 * Check if a path matches the keyish pattern (secrets/keys)
 */
export declare function isKeyishPath(path: string): boolean;
/**
 * Check if file size is valid for upload
 */
export declare function isValidFileSize(sizeBytes: number, maxFileSize?: number): boolean;
/**
 * Check if file content is valid UTF-8 (not binary)
 */
export declare function isValidUtf8(content: Buffer): boolean;
/**
 * Check if a file should be filtered out
 * Returns { filtered: true, reason: string } if file should be skipped
 * Returns { filtered: false } if file should be included
 *
 * Priority order:
 * 1. Path validation (contains "..")
 * 2. File size check
 * 3. .augmentignore rules (checked by caller)
 * 4. Keyish patterns
 * 5. .gitignore rules (checked by caller)
 * 6. UTF-8 validation
 */
export declare function shouldFilterFile(params: {
    path: string;
    content: Buffer;
    maxFileSize?: number;
}): {
    filtered: boolean;
    reason?: string;
};
//# sourceMappingURL=file-filter.d.ts.map