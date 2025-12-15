/**
 * Search tool - Semantic search across indexed content.
 *
 * Uses DirectContext to find relevant code snippets based on
 * natural language queries.
 *
 * @module tools/search
 */
/**
 * Search the indexed content using natural language.
 *
 * This is the core search function used by SearchClient and tool interfaces.
 * It delegates to DirectContext.search() and wraps the result.
 *
 * @param ctx - Tool context containing the DirectContext instance
 * @param query - Natural language search query
 * @param options - Optional search options (e.g., maxOutputLength)
 * @returns Search result containing matching code snippets
 *
 * @example
 * ```typescript
 * const result = await search(ctx, "database connection pooling", {
 *   maxOutputLength: 5000,
 * });
 * console.log(result.results);
 * ```
 */
export async function search(ctx, query, options) {
    const results = await ctx.context.search(query, {
        maxOutputLength: options?.maxOutputLength,
    });
    return { results: results ?? "", query };
}
//# sourceMappingURL=search.js.map