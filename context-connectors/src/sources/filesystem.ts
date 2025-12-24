/**
 * Filesystem Source - Fetches files from the local filesystem.
 *
 * Indexes files from a local directory with automatic filtering:
 * - Respects .gitignore and .augmentignore patterns
 * - Filters binary files, large files, and secrets
 * - Skips common non-code directories (node_modules, .git, etc.)
 *
 * @module sources/filesystem
 *
 * @example
 * ```typescript
 * import { FilesystemSource } from "@augmentcode/context-connectors/sources";
 *
 * const source = new FilesystemSource({
 *   rootPath: "./my-project",
 *   ignorePatterns: ["*.log", "tmp/"],
 * });
 *
 * // For indexing
 * const files = await source.fetchAll();
 *
 * // For clients
 * const fileList = await source.listFiles();
 * const contents = await source.readFile("src/index.ts");
 * ```
 */

import { promises as fs } from "node:fs";
import { join, relative, resolve } from "node:path";
import ignoreFactory, { type Ignore } from "ignore";
import { shouldFilterFile } from "../core/file-filter.js";
import { isoTimestamp } from "../core/utils.js";
import type { FileEntry, FileInfo, SourceMetadata } from "../core/types.js";
import type { FileChanges, Source } from "./types.js";

// With NodeNext module resolution, we need to access the default export properly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ignore = (ignoreFactory as any).default ?? ignoreFactory;

/**
 * Configuration for FilesystemSource.
 */
export interface FilesystemSourceConfig {
  /** Root directory to index (can be relative or absolute) */
  rootPath: string;
  /**
   * Additional patterns to ignore.
   * Added on top of .gitignore/.augmentignore patterns.
   */
  ignorePatterns?: string[];
}

/** Default directories to always skip */
const DEFAULT_SKIP_DIRS = new Set([".git", "node_modules", "__pycache__", ".venv", "venv"]);

/**
 * Source implementation for local filesystem directories.
 *
 * Walks the directory tree, applying filters in this order:
 * 1. Skip default directories (.git, node_modules, etc.)
 * 2. Apply .augmentignore patterns (highest priority)
 * 3. Apply built-in filters (binary, large files, secrets)
 * 4. Apply .gitignore patterns (lowest priority)
 *
 * @example
 * ```typescript
 * const source = new FilesystemSource({ rootPath: "./my-project" });
 *
 * // Get all indexable files
 * const files = await source.fetchAll();
 * console.log(`Found ${files.length} files`);
 *
 * // Read a specific file
 * const content = await source.readFile("package.json");
 * ```
 */
export class FilesystemSource implements Source {
  readonly type = "filesystem" as const;
  private readonly rootPath: string;
  private readonly ignorePatterns: string[];

  /**
   * Create a new FilesystemSource.
   *
   * @param config - Source configuration
   */
  constructor(config: FilesystemSourceConfig) {
    this.rootPath = resolve(config.rootPath);
    this.ignorePatterns = config.ignorePatterns ?? [];
  }

  /**
   * Load ignore rules from .gitignore and .augmentignore files
   */
  private async loadIgnoreRules(): Promise<{ augmentignore: Ignore; gitignore: Ignore }> {
    const augmentignore = ignore();
    const gitignore = ignore();

    // Load .gitignore if exists
    try {
      const gitignoreContent = await fs.readFile(join(this.rootPath, ".gitignore"), "utf-8");
      gitignore.add(gitignoreContent);
    } catch {
      // .gitignore doesn't exist
    }

    // Load .augmentignore if exists
    try {
      const augmentignoreContent = await fs.readFile(join(this.rootPath, ".augmentignore"), "utf-8");
      augmentignore.add(augmentignoreContent);
    } catch {
      // .augmentignore doesn't exist
    }

    // Add custom ignore patterns to gitignore (lowest priority)
    if (this.ignorePatterns.length > 0) {
      gitignore.add(this.ignorePatterns);
    }

    return { augmentignore, gitignore };
  }

  /**
   * Recursively walk directory and collect files
   */
  private async walkDirectory(
    dir: string,
    augmentignore: Ignore,
    gitignore: Ignore,
    files: FileEntry[]
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(this.rootPath, fullPath);

      // Skip default ignored directories
      if (entry.isDirectory() && DEFAULT_SKIP_DIRS.has(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Check directory against ignore patterns before descending
        const dirPath = relativePath + "/";
        if (augmentignore.ignores(dirPath) || gitignore.ignores(dirPath)) {
          continue;
        }
        await this.walkDirectory(fullPath, augmentignore, gitignore, files);
      } else if (entry.isFile()) {
        // Apply ignore rules in priority order:
        // 1. .augmentignore (highest priority)
        if (augmentignore.ignores(relativePath)) {
          continue;
        }

        // 2. Read file content for filtering
        let content: Buffer;
        try {
          content = await fs.readFile(fullPath);
        } catch {
          continue; // Skip unreadable files
        }

        // 3. Apply shouldFilterFile (path validation, size, keyish, UTF-8)
        const filterResult = shouldFilterFile({ path: relativePath, content });
        if (filterResult.filtered) {
          continue;
        }

        // 4. .gitignore (lowest priority)
        if (gitignore.ignores(relativePath)) {
          continue;
        }

        // File passed all filters
        files.push({
          path: relativePath,
          contents: content.toString("utf-8"),
        });
      }
    }
  }

  async fetchAll(): Promise<FileEntry[]> {
    const { augmentignore, gitignore } = await this.loadIgnoreRules();
    const files: FileEntry[] = [];
    await this.walkDirectory(this.rootPath, augmentignore, gitignore, files);
    return files;
  }

  async listFiles(directory: string = ""): Promise<FileInfo[]> {
    const targetDir = join(this.rootPath, directory);

    // Prevent path traversal
    const resolvedTarget = resolve(targetDir);
    if (!resolvedTarget.startsWith(this.rootPath)) {
      return [];
    }

    try {
      const entries = await fs.readdir(targetDir, { withFileTypes: true });
      const results: FileInfo[] = [];

      for (const entry of entries) {
        // Skip default ignored directories
        if (entry.isDirectory() && DEFAULT_SKIP_DIRS.has(entry.name)) {
          continue;
        }

        const entryPath = directory ? join(directory, entry.name) : entry.name;

        results.push({
          path: entryPath,
          type: entry.isDirectory() ? "directory" : "file",
        });
      }

      return results;
    } catch {
      // Directory doesn't exist or isn't readable
      return [];
    }
  }

  async fetchChanges(_previous: SourceMetadata): Promise<FileChanges | null> {
    // For Phase 2, return null to force full reindex
    // Incremental updates can be enhanced later
    return null;
  }

  async getMetadata(): Promise<SourceMetadata> {
    return {
      type: "filesystem",
      identifier: this.rootPath,
      syncedAt: isoTimestamp(),
    };
  }

  async readFile(path: string): Promise<string | null> {
    // Prevent path traversal
    const fullPath = join(this.rootPath, path);
    const resolvedPath = resolve(fullPath);
    if (!resolvedPath.startsWith(this.rootPath)) {
      return null;
    }

    try {
      return await fs.readFile(resolvedPath, "utf-8");
    } catch {
      return null;
    }
  }
}

