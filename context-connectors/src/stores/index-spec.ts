/**
 * Index specification parsing for CLI commands.
 *
 * Supports three types of index specs:
 * - Named index: `my-project` (resolved via store-path)
 * - Filesystem path: `path:/absolute/path` or `path:./relative`
 * - S3 URL: `s3://bucket/prefix/index`
 *
 * @module stores/index-spec
 */

/**
 * Parsed index specification.
 */
export interface IndexSpec {
  /** Type of index source */
  type: "name" | "path" | "s3";

  /**
   * The value after parsing:
   * - For "name": the index name
   * - For "path": the filesystem path
   * - For "s3": the full s3:// URL
   */
  value: string;

  /**
   * Display name for the index (used in MCP tools).
   * Derived from the last path component or the name itself.
   */
  displayName: string;
}

/**
 * Parse an index specification string.
 *
 * @param spec - The index spec string
 * @returns Parsed IndexSpec
 * @throws Error if the spec is invalid
 *
 * @example
 * ```typescript
 * parseIndexSpec("my-project")
 * // { type: "name", value: "my-project", displayName: "my-project" }
 *
 * parseIndexSpec("path:/data/indexes/foo")
 * // { type: "path", value: "/data/indexes/foo", displayName: "foo" }
 *
 * parseIndexSpec("s3://my-bucket/indexes/bar")
 * // { type: "s3", value: "s3://my-bucket/indexes/bar", displayName: "bar" }
 * ```
 */
export function parseIndexSpec(spec: string): IndexSpec {
  if (!spec || spec.trim() === "") {
    throw new Error("Index spec cannot be empty");
  }

  spec = spec.trim();

  // Check for s3:// URL
  if (spec.startsWith("s3://")) {
    const url = spec;
    // Extract display name from the last path component
    const pathPart = url.slice(5); // Remove "s3://"
    const parts = pathPart.split("/").filter((p) => p.length > 0);
    if (parts.length < 2) {
      throw new Error(
        `Invalid S3 URL "${spec}": must have bucket and at least one path component`
      );
    }
    const displayName = parts[parts.length - 1];
    return { type: "s3", value: url, displayName };
  }

  // Check for path: prefix
  if (spec.startsWith("path:")) {
    const path = spec.slice(5); // Remove "path:"
    if (!path) {
      throw new Error(`Invalid path spec "${spec}": path cannot be empty`);
    }
    // Extract display name from the last path component
    const parts = path.split("/").filter((p) => p.length > 0 && p !== "." && p !== "..");
    const displayName = parts.length > 0 ? parts[parts.length - 1] : "index";
    return { type: "path", value: path, displayName };
  }

  // Check for name: prefix (explicit, optional)
  if (spec.startsWith("name:")) {
    const name = spec.slice(5); // Remove "name:"
    if (!name) {
      throw new Error(`Invalid name spec "${spec}": name cannot be empty`);
    }
    return { type: "name", value: name, displayName: name };
  }

  // Default: treat as named index
  // Validate that it doesn't look like a URL or path
  if (spec.includes("://")) {
    throw new Error(
      `Unknown URL scheme in "${spec}". Supported: s3://`
    );
  }

  return { type: "name", value: spec, displayName: spec };
}

/**
 * Parse multiple index specifications.
 *
 * Also handles display name conflicts by appending a suffix.
 *
 * @param specs - Array of index spec strings
 * @returns Array of parsed IndexSpecs with unique display names
 */
export function parseIndexSpecs(specs: string[]): IndexSpec[] {
  const parsed = specs.map(parseIndexSpec);

  // Check for display name conflicts and resolve them
  const nameCounts = new Map<string, number>();
  for (const spec of parsed) {
    nameCounts.set(spec.displayName, (nameCounts.get(spec.displayName) || 0) + 1);
  }

  // If there are conflicts, append type suffix to disambiguate
  const nameIndices = new Map<string, number>();
  for (const spec of parsed) {
    const count = nameCounts.get(spec.displayName) || 0;
    if (count > 1) {
      const idx = (nameIndices.get(spec.displayName) || 0) + 1;
      nameIndices.set(spec.displayName, idx);
      // Append index to make unique: foo, foo-2, foo-3, etc.
      if (idx > 1) {
        spec.displayName = `${spec.displayName}-${idx}`;
      }
    }
  }

  return parsed;
}

