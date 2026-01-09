/**
 * Read file tool - Read a single file from a source.
 *
 * Provides file reading functionality for the readFile tool with:
 * - Line numbers (cat -n format)
 * - View range (partial file reading)
 * - Output truncation
 * - Regex search with context lines
 * - Path auto-correction suggestions
 *
 * Requires a Source to be configured in the tool context.
 *
 * @module tools/read-file
 */

import type { ToolContext } from "./types.js";

/** Default maximum output length in characters */
const DEFAULT_MAX_OUTPUT = 50000;

/** Truncation message appended when output is clipped */
const TRUNCATION_MESSAGE = "\n<response clipped><NOTE>To save on context only part of this file has been shown to you.</NOTE>";

/**
 * Options for reading a file.
 */
export interface ReadFileOptions {
  /**
   * First line to read (1-based, inclusive).
   * @default 1
   */
  startLine?: number;
  /**
   * Last line to read (1-based, inclusive). Use -1 for end of file.
   * @default -1
   */
  endLine?: number;
  /**
   * Include line numbers in output (cat -n format).
   * @default true
   */
  includeLineNumbers?: boolean;
  /**
   * Maximum characters in output. Truncates with message if exceeded.
   * @default 50000
   */
  maxOutputLength?: number;
  /**
   * Regex pattern to search for within the file.
   * When specified, only matching lines (with context) are returned.
   */
  searchPattern?: string;
  /**
   * Case-sensitive regex matching.
   * @default false
   */
  caseSensitive?: boolean;
  /**
   * Lines of context to show before each match.
   * @default 5
   */
  contextLinesBefore?: number;
  /**
   * Lines of context to show after each match.
   * @default 5
   */
  contextLinesAfter?: number;
}

/**
 * Result from reading a file.
 */
export interface ReadFileResult {
  /** The path that was requested */
  path: string;
  /** Formatted file contents if successful, null if not found */
  contents: string | null;
  /** Total number of lines in the file */
  totalLines?: number;
  /** Whether output was truncated */
  truncated?: boolean;
  /** Error message if the file couldn't be read */
  error?: string;
  /** Suggested similar paths if file not found */
  suggestions?: string[];
}

/**
 * Format a line with line number (cat -n format).
 * Line numbers are right-padded to 6 characters.
 */
function formatLine(lineNum: number, content: string): string {
  return `${String(lineNum).padStart(6, " ")}\t${content}`;
}

/**
 * Truncate output if it exceeds maxLength.
 */
function maybeTruncate(
  output: string,
  maxLength: number
): { text: string; truncated: boolean } {
  if (output.length <= maxLength) {
    return { text: output, truncated: false };
  }

  // If maxLength is too small to fit the truncation message,
  // just slice the output without the message to respect the limit
  if (maxLength <= TRUNCATION_MESSAGE.length) {
    return {
      text: output.slice(0, maxLength),
      truncated: true,
    };
  }

  const truncateAt = maxLength - TRUNCATION_MESSAGE.length;
  return {
    text: output.slice(0, truncateAt) + TRUNCATION_MESSAGE,
    truncated: true,
  };
}

/**
 * Validate and normalize view range.
 */
function normalizeRange(
  startLine: number | undefined,
  endLine: number | undefined,
  totalLines: number
): { start: number; end: number } {
  let start = startLine ?? 1;
  let end = endLine ?? -1;

  // Clamp start
  if (start < 1) start = 1;
  if (start > totalLines) start = totalLines;

  // Handle -1 as "end of file"
  if (end === -1) end = totalLines;

  // Clamp end
  if (end < start) end = start;
  if (end > totalLines) end = totalLines;

  return { start, end };
}

/**
 * Perform regex search and return matching lines with context.
 */
function searchWithContext(
  lines: string[],
  pattern: string,
  caseSensitive: boolean,
  contextBefore: number,
  contextAfter: number
): { lineNumbers: Set<number>; matchingLines: Set<number> } {
  const flags = caseSensitive ? "g" : "gi";
  const regex = new RegExp(pattern, flags);

  const matchingLines = new Set<number>();
  const lineNumbers = new Set<number>();

  // Find all matching lines
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      matchingLines.add(i);
      // Add context lines
      for (let j = Math.max(0, i - contextBefore); j <= Math.min(lines.length - 1, i + contextAfter); j++) {
        lineNumbers.add(j);
      }
    }
    // Reset regex lastIndex for global flag
    regex.lastIndex = 0;
  }

  return { lineNumbers, matchingLines };
}

/**
 * Read a single file from the source.
 *
 * This function requires a Source to be configured in the context.
 * When called in search-only mode (no Source), it throws an error.
 *
 * Features:
 * - Line numbers in cat -n format (default: on)
 * - View range for partial file reading
 * - Output truncation to prevent context overflow
 * - Regex search with configurable context lines
 * - Path suggestions on file not found
 *
 * @param ctx - Tool context (must have source configured)
 * @param path - Relative path to the file
 * @param options - Optional reading options
 * @returns Result with contents or error
 * @throws Error if no Source is configured
 *
 * @example
 * ```typescript
 * // Basic usage with line numbers
 * const result = await readFile(ctx, "src/index.ts");
 *
 * // Read specific range
 * const result = await readFile(ctx, "src/index.ts", {
 *   startLine: 10,
 *   endLine: 50,
 * });
 *
 * // Search within file
 * const result = await readFile(ctx, "src/index.ts", {
 *   searchPattern: "function.*export",
 *   contextLinesBefore: 3,
 *   contextLinesAfter: 10,
 * });
 * ```
 */
export async function readFile(
  ctx: ToolContext,
  path: string,
  options: ReadFileOptions = {}
): Promise<ReadFileResult> {
  if (!ctx.source) {
    throw new Error("Source not configured. Cannot read files in search-only mode.");
  }

  const {
    includeLineNumbers = true,
    maxOutputLength = DEFAULT_MAX_OUTPUT,
    searchPattern,
    caseSensitive = false,
    contextLinesBefore = 5,
    contextLinesAfter = 5,
  } = options;

  const rawContents = await ctx.source.readFile(path);

  if (rawContents === null) {
    // Try to find similar paths for suggestions
    const suggestions = await findSimilarPaths(ctx, path);
    return {
      path,
      contents: null,
      error: "File not found or not readable",
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  const lines = rawContents.split("\n");
  const totalLines = lines.length;

  // Normalize view range
  const { start, end } = normalizeRange(options.startLine, options.endLine, totalLines);

  let output: string;

  if (searchPattern) {
    // Regex search mode
    const { lineNumbers, matchingLines } = searchWithContext(
      lines,
      searchPattern,
      caseSensitive,
      contextLinesBefore,
      contextLinesAfter
    );

    if (lineNumbers.size === 0) {
      return {
        path,
        contents: `No matches found for pattern: ${searchPattern}`,
        totalLines,
        truncated: false,
      };
    }

    // Build output with gaps shown as "..."
    const sortedLines = Array.from(lineNumbers).sort((a, b) => a - b);
    const outputLines: string[] = [];
    let lastLine = -2; // -2 so first line doesn't trigger gap

    for (const lineIdx of sortedLines) {
      // Skip lines outside view range
      const lineNum = lineIdx + 1;
      if (lineNum < start || lineNum > end) continue;

      // Add gap marker if there's a discontinuity
      if (lineIdx > lastLine + 1) {
        outputLines.push("...");
      }

      // Format line with optional match marker
      const prefix = matchingLines.has(lineIdx) ? ">" : " ";
      if (includeLineNumbers) {
        outputLines.push(`${prefix}${formatLine(lineNum, lines[lineIdx])}`);
      } else {
        outputLines.push(`${prefix} ${lines[lineIdx]}`);
      }
      lastLine = lineIdx;
    }

    output = `Here's the result of searching for '${searchPattern}' in ${path}:\n${outputLines.join("\n")}\nTotal lines in file: ${totalLines}`;
  } else {
    // Normal file viewing mode
    const selectedLines = lines.slice(start - 1, end);

    if (includeLineNumbers) {
      const formattedLines = selectedLines.map((line, idx) =>
        formatLine(start + idx, line)
      );
      output = `Here's the result of running \`cat -n\` on ${path}:\n${formattedLines.join("\n")}\nTotal lines in file: ${totalLines}`;
    } else {
      output = selectedLines.join("\n");
    }
  }

  // Apply truncation
  const { text, truncated } = maybeTruncate(output, maxOutputLength);

  return {
    path,
    contents: text,
    totalLines,
    truncated,
  };
}

/**
 * Find similar file paths for suggestions.
 * Uses filename matching and path similarity.
 */
async function findSimilarPaths(ctx: ToolContext, path: string): Promise<string[]> {
  if (!ctx.source) return [];

  // Extract filename from path
  const parts = path.split("/");
  const filename = parts[parts.length - 1];

  // List files from root and search for similar names
  // This is a simplified approach; could be enhanced with LCS ranking
  const suggestions: string[] = [];

  try {
    // Try to list files from the parent directories
    const parentPath = parts.slice(0, -1).join("/");
    const entries = await ctx.source.listFiles(parentPath || undefined);

    for (const entry of entries) {
      if (entry.type === "file") {
        const entryName = entry.path.split("/").pop() || "";
        // Simple similarity: same extension or contains filename
        if (
          entryName.toLowerCase().includes(filename.toLowerCase()) ||
          filename.toLowerCase().includes(entryName.toLowerCase())
        ) {
          suggestions.push(entry.path);
        }
      }
    }
  } catch {
    // Ignore errors in suggestion finding
  }

  return suggestions.slice(0, 5); // Max 5 suggestions
}

