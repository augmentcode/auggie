/**
 * List files tool - List files from a source.
 *
 * Provides file listing functionality with optional glob filtering.
 * Requires a Source to be configured in the tool context.
 *
 * @module tools/list-files
 */

import type { FileInfo } from "../core/types.js";
import type { ToolContext } from "./types.js";

/**
 * Options for listing files.
 */
export interface ListFilesOptions {
  /**
   * Glob pattern to filter files.
   * Uses minimatch for pattern matching.
   * @example "**\/*.ts", "src/**", "*.json"
   */
  pattern?: string;
}

/**
 * List files from the source with optional filtering.
 *
 * This function requires a Source to be configured in the context.
 * When called in search-only mode (no Source), it throws an error.
 *
 * @param ctx - Tool context (must have source configured)
 * @param options - Optional filter options
 * @returns Array of file info objects with paths
 * @throws Error if no Source is configured
 *
 * @example
 * ```typescript
 * // List all files
 * const allFiles = await listFiles(ctx);
 *
 * // List only TypeScript files
 * const tsFiles = await listFiles(ctx, { pattern: "**\/*.ts" });
 *
 * // List files in src directory
 * const srcFiles = await listFiles(ctx, { pattern: "src/**" });
 * ```
 */
export async function listFiles(
  ctx: ToolContext,
  options?: ListFilesOptions
): Promise<FileInfo[]> {
  if (!ctx.source) {
    throw new Error("Source not configured. Cannot list files in search-only mode.");
  }

  let files = await ctx.source.listFiles();

  // Optional: filter by pattern using minimatch
  if (options?.pattern) {
    const { minimatch } = await import("minimatch");
    files = files.filter((f) => minimatch(f.path, options.pattern!));
  }

  return files;
}

