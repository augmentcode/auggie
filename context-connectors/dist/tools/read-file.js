/**
 * Read file tool - Read a single file from a source.
 *
 * Provides file reading functionality for the readFile tool.
 * Requires a Source to be configured in the tool context.
 *
 * @module tools/read-file
 */
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
export async function readFile(ctx, path) {
    if (!ctx.source) {
        throw new Error("Source not configured. Cannot read files in search-only mode.");
    }
    const contents = await ctx.source.readFile(path);
    if (contents === null) {
        return { path, contents: null, error: "File not found or not readable" };
    }
    return { path, contents };
}
//# sourceMappingURL=read-file.js.map