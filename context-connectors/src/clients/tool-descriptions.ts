/**
 * Shared tool descriptions for search, list_files, and read_file tools.
 * Used by both MCP server and CLI agent.
 *
 * @module clients/tool-descriptions
 */

/**
 * Base description for the search tool.
 * Does not include the "Available indexes" section - callers should append that.
 */
export const SEARCH_DESCRIPTION = `Search indexed content using natural language to find relevant files and snippets.

Parameters:
- query (required): Natural language description ("authentication logic", "error handling")
- maxChars (optional): Max characters in response (default: reasonable limit)

Returns: Snippets with file paths and line numbers.
Example output:
Path: src/auth/login.ts
    15: function authenticateUser(username, password) {
    16:   return validateCredentials(username, password);

Path format: Paths are relative to the index root
✅ "src/auth/login.ts"  ❌ "/repo/src/auth/login.ts"`;

/**
 * Base description for the list_files tool.
 * Does not include the "Available indexes" section - callers should append that.
 */
export const LIST_FILES_DESCRIPTION = `List files and directories to explore the index structure.

Parameters:
- directory (optional): Path relative to index root (default: "" for root)
- depth (optional): Recursion depth (default: 2, max recommended: 5)
- pattern (optional): Glob filter ("*.ts", "src/**/*.test.js")
- showHidden (optional): Include hidden files (default: false)

Returns: Directory tree structure with files and subdirectories

Path format: Relative to index root
✅ "src/components", ""  ❌ "/repo/src", "./src"`;

/**
 * Base description for the read_file tool.
 * Does not include the "Available indexes" section - callers should append that.
 */
export const READ_FILE_DESCRIPTION = `Read file contents with line numbers, optionally filtered by line range or regex pattern.

Parameters:
- path (required): File path relative to index root
- startLine (optional): First line to read (1-based, default: 1)
- endLine (optional): Last line to read (-1 for end, default: -1)
- searchPattern (optional): Regex filter - returns only matching lines with context
- contextLinesBefore/After (optional): Context lines around matches (default: 5)
- includeLineNumbers (optional): Show line numbers (default: true)

Returns: File contents with line numbers

Path format: Relative to index root
✅ "src/main.ts", "package.json"  ❌ "/repo/src/main.ts"

Regex: Supports basic patterns (., [abc], *, +, ?, ^, $, |)
NOT supported: \\d, \\s, \\w (use [0-9], [ \\t], [a-zA-Z_] instead)`;

/**
 * Format a tool description with available indexes for multi-index mode.
 */
export function withIndexList(baseDescription: string, indexListStr: string): string {
  return `${baseDescription}

Available indexes:
${indexListStr}`;
}

