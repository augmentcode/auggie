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
   * Directory to list (default: root "").
   * Only immediate children of this directory are returned.
   * @example "src", "src/utils"
   */
  directory?: string;
  /**
   * Glob pattern to filter results within the directory.
   * Uses minimatch for pattern matching.
   * @example "*.ts", "*.json"
   */
  pattern?: string;
}

/**
 * List files and directories from the source (non-recursive).
 *
 * This function requires a Source to be configured in the context.
 * When called in search-only mode (no Source), it throws an error.
 *
 * Returns only immediate children of the specified directory.
 * Each result includes a type field ("file" or "directory").
 *
 * @param ctx - Tool context (must have source configured)
 * @param options - Optional filter options
 * @returns Array of file/directory info objects
 * @throws Error if no Source is configured
 *
 * @example
 * ```typescript
 * // List root directory
 * const root = await listFiles(ctx);
 * // Returns: [{ path: "src", type: "directory" }, { path: "README.md", type: "file" }]
 *
 * // List specific directory
 * const srcFiles = await listFiles(ctx, { directory: "src" });
 * // Returns: [{ path: "src/index.ts", type: "file" }, { path: "src/utils", type: "directory" }]
 *
 * // Filter by pattern
 * const tsFiles = await listFiles(ctx, { directory: "src", pattern: "*.ts" });
 * ```
 */
export async function listFiles(
  ctx: ToolContext,
  options?: ListFilesOptions
): Promise<FileInfo[]> {
  if (!ctx.source) {
    throw new Error("Source not configured. Cannot list files in search-only mode.");
  }

  let entries = await ctx.source.listFiles(options?.directory);

  // Optional: filter by pattern using minimatch (applies to filename only within directory)
  if (options?.pattern) {
    const { minimatch } = await import("minimatch");
    const { basename } = await import("node:path");
    entries = entries.filter((f) => minimatch(basename(f.path), options.pattern!));
  }

  return entries;
}

