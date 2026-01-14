/**
 * List files tool - List files from a source.
 *
 * Provides file listing functionality with:
 * - Recursive depth control
 * - Glob pattern filtering
 * - Output truncation
 * - Hidden file filtering
 *
 * Requires a Source to be configured in the tool context.
 *
 * @module tools/list-files
 */

import type { FileInfo } from "../core/types.js";
import type { ToolContext } from "./types.js";
import { normalizePath } from "../core/utils.js";

/** Default maximum output length in characters */
const DEFAULT_MAX_OUTPUT = 50000;

/** Default directory depth */
const DEFAULT_DEPTH = 2;

/**
 * Options for listing files.
 */
export interface ListFilesOptions {
  /**
   * Directory to list (default: root "").
   * @example "src", "src/utils"
   */
  directory?: string;
  /**
   * Glob pattern to filter results.
   * Uses minimatch for pattern matching.
   * @example "*.ts", "*.json"
   */
  pattern?: string;
  /**
   * Maximum depth to recurse into subdirectories.
   * 1 = immediate children only, 2 = one level of subdirectories, etc.
   * @default 2
   */
  depth?: number;
  /**
   * Whether to include hidden files (starting with .).
   * @default false
   */
  showHidden?: boolean;
  /**
   * Maximum characters in output.
   * @default 50000
   */
  maxOutputLength?: number;
}

/**
 * Result from listing files.
 */
export interface ListFilesResult {
  /** Array of file/directory entries */
  entries: FileInfo[];
  /** Whether output was truncated */
  truncated?: boolean;
  /** Number of entries omitted due to truncation */
  omittedCount?: number;
}

/**
 * Format list entries as text with a descriptive header.
 *
 * @param result - Result from listFiles containing entries and truncation info
 * @param options - The options used for listing (for header context)
 * @returns Formatted string with header and entries
 */
export function formatListOutput(
  result: ListFilesResult,
  options?: ListFilesOptions
): string {
  const { entries, truncated, omittedCount } = result;

  if (entries.length === 0) {
    return "No files found.";
  }

  const directory = options?.directory || "the root directory";
  const depth = options?.depth ?? DEFAULT_DEPTH;
  const showHidden = options?.showHidden ?? false;

  // Build header with proper grammar
  const depthDesc = depth === 1
    ? "immediate children"
    : `files and directories up to ${depth} levels deep`;
  const hiddenDesc = showHidden ? "including" : "excluding";
  const header = `Here are the ${depthDesc} in ${directory}, ${hiddenDesc} hidden items:\n`;

  const body = entries.map((e) => `${e.path} [${e.type}]`).join("\n");

  // Add truncation notice if applicable
  const truncationNotice = truncated
    ? `\n\n... (${omittedCount} more entries omitted due to output limit)`
    : "";

  return header + body + truncationNotice;
}

/**
 * List files and directories from the source with depth control.
 *
 * This function requires a Source to be configured in the context.
 * When called in search-only mode (no Source), it throws an error.
 *
 * Features:
 * - Recursive listing up to specified depth (default: 2)
 * - Optional glob pattern filtering
 * - Hidden file filtering
 * - Output truncation
 *
 * @param ctx - Tool context (must have source configured)
 * @param options - Optional filter and depth options
 * @returns Result with entries array and truncation metadata
 * @throws Error if no Source is configured
 *
 * @example
 * ```typescript
 * // List with default depth (2 levels)
 * const { entries, truncated } = await listFiles(ctx);
 *
 * // List only immediate children
 * const result = await listFiles(ctx, { depth: 1 });
 *
 * // List deeper with pattern filter
 * const { entries, omittedCount } = await listFiles(ctx, {
 *   directory: "src",
 *   pattern: "*.ts",
 *   depth: 3,
 * });
 * ```
 */
export async function listFiles(
  ctx: ToolContext,
  options?: ListFilesOptions
): Promise<ListFilesResult> {
  if (!ctx.source) {
    throw new Error("Source not configured. Cannot list files in search-only mode.");
  }

  const {
    directory = "",
    pattern,
    depth = DEFAULT_DEPTH,
    showHidden = false,
    maxOutputLength = DEFAULT_MAX_OUTPUT,
  } = options ?? {};

  // Normalize directory path to avoid issues with leading/trailing slashes
  const normalizedDirectory = normalizePath(directory);

  // Collect entries recursively up to depth
  const allEntries: FileInfo[] = [];
  await collectEntries(ctx, normalizedDirectory, depth, showHidden, allEntries);

  // Apply pattern filter if specified
  let filteredEntries = allEntries;
  if (pattern) {
    const { minimatch } = await import("minimatch");
    // Use matchBase to allow "*.ts" to match basename while "src/*.ts" matches full path
    filteredEntries = allEntries.filter((f) =>
      minimatch(f.path, pattern, { matchBase: true })
    );
  }

  // Sort entries alphabetically
  filteredEntries.sort((a, b) => a.path.localeCompare(b.path));

  // Apply truncation based on output length
  let entries = filteredEntries;
  let truncated = false;
  let omittedCount = 0;

  // Estimate output size (path + type annotation + newline)
  let estimatedSize = 0;
  for (let i = 0; i < filteredEntries.length; i++) {
    const entry = filteredEntries[i];
    const entrySize = entry.path.length + entry.type.length + 5; // " [type]\n"
    if (estimatedSize + entrySize > maxOutputLength) {
      entries = filteredEntries.slice(0, i);
      omittedCount = filteredEntries.length - i;
      truncated = true;
      break;
    }
    estimatedSize += entrySize;
  }

  return { entries, truncated, omittedCount };
}

/**
 * Recursively collect entries up to specified depth.
 */
async function collectEntries(
  ctx: ToolContext,
  directory: string,
  remainingDepth: number,
  showHidden: boolean,
  results: FileInfo[]
): Promise<void> {
  if (remainingDepth <= 0 || !ctx.source) return;

  const entries = await ctx.source.listFiles(directory);

  for (const entry of entries) {
    // Skip hidden files unless requested
    const name = entry.path.split("/").pop() || "";
    if (!showHidden && name.startsWith(".")) {
      continue;
    }

    results.push(entry);

    // Recurse into directories
    if (entry.type === "directory" && remainingDepth > 1) {
      await collectEntries(ctx, entry.path, remainingDepth - 1, showHidden, results);
    }
  }
}

