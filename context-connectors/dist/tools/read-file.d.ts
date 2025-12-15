/**
 * Read file tool - Read a single file from a source.
 *
 * Provides file reading functionality for the readFile tool.
 * Requires a Source to be configured in the tool context.
 *
 * @module tools/read-file
 */
import type { ToolContext } from "./types.js";
/**
 * Result from reading a file.
 */
export interface ReadFileResult {
    /** The path that was requested */
    path: string;
    /** File contents if successful, null if not found */
    contents: string | null;
    /** Error message if the file couldn't be read */
    error?: string;
}
/**
 * Read a single file from the source.
 *
 * This function requires a Source to be configured in the context.
 * When called in search-only mode (no Source), it throws an error.
 *
 * Returns a result object rather than throwing on file not found,
 * allowing callers to handle missing files gracefully.
 *
 * @param ctx - Tool context (must have source configured)
 * @param path - Relative path to the file
 * @returns Result with contents or error
 * @throws Error if no Source is configured
 *
 * @example
 * ```typescript
 * const result = await readFile(ctx, "src/index.ts");
 *
 * if (result.contents) {
 *   console.log(`File contents:\n${result.contents}`);
 * } else {
 *   console.error(`Error: ${result.error}`);
 * }
 * ```
 */
export declare function readFile(ctx: ToolContext, path: string): Promise<ReadFileResult>;
//# sourceMappingURL=read-file.d.ts.map