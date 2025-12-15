/**
 * Tool context and types for client tool implementations.
 *
 * Tools are the low-level functions that power client operations:
 * - `search`: Semantic search using DirectContext
 * - `listFiles`: List files from the source
 * - `readFile`: Read file contents from the source
 *
 * These tools are used by:
 * - SearchClient (programmatic access)
 * - MCP Server (Claude Desktop)
 * - AI SDK Tools (Vercel AI SDK)
 *
 * @module tools/types
 */
import type { DirectContext } from "@augmentcode/auggie-sdk";
import type { Source } from "../sources/types.js";
import type { FileInfo, IndexState } from "../core/types.js";
export type { FileInfo };
/**
 * Context passed to tool implementations.
 *
 * Contains all the resources needed for tool operations:
 * - DirectContext for search
 * - Source for file operations (optional)
 * - IndexState for metadata
 *
 * @example
 * ```typescript
 * const ctx: ToolContext = {
 *   context: directContext,
 *   source: filesystemSource, // or null for search-only
 *   state: indexState,
 * };
 *
 * const result = await search(ctx, "authentication");
 * ```
 */
export interface ToolContext {
    /** DirectContext instance for search operations */
    context: DirectContext;
    /**
     * Source for file operations.
     * Null if client is in search-only mode (no listFiles/readFile).
     */
    source: Source | null;
    /** The loaded IndexState for metadata access */
    state: IndexState;
}
/**
 * Options for the search tool.
 */
export interface SearchOptions {
    /**
     * Maximum characters in the search response.
     * Useful for limiting context size when used with LLMs.
     */
    maxOutputLength?: number;
}
//# sourceMappingURL=types.d.ts.map