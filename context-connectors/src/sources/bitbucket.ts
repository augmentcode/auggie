/**
 * BitBucket Source - Fetches files from BitBucket repositories
 *
 * Features:
 * - Full indexing via archive download
 * - Incremental updates via Diff API
 * - Force push detection (triggers full re-index)
 * - Respects .gitignore and .augmentignore
 * - Supports both BitBucket Cloud and BitBucket Server/Data Center
 *
 * @module sources/bitbucket
 */

import ignoreFactory, { type Ignore } from "ignore";
import { shouldFilterFile } from "../core/file-filter.js";
import { isoTimestamp } from "../core/utils.js";
import type { FileEntry, FileInfo, SourceMetadata } from "../core/types.js";
import type { FileChanges, Source } from "./types.js";

// With NodeNext module resolution, we need to access the default export properly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ignore = (ignoreFactory as any).default ?? ignoreFactory;

/** Configuration for BitBucketSource */
export interface BitBucketSourceConfig {
  /** BitBucket access token. Defaults to process.env.BITBUCKET_TOKEN */
  token?: string;
  /** BitBucket base URL. Defaults to https://api.bitbucket.org/2.0 for Cloud */
  baseUrl?: string;
  /** Workspace slug (for BitBucket Cloud) */
  workspace: string;
  /** Repository slug */
  repo: string;
  /** Branch/tag/commit ref. Defaults to "HEAD" */
  ref?: string;
}

export class BitBucketSource implements Source {
  readonly type = "bitbucket" as const;
  private readonly baseUrl: string;
  private readonly workspace: string;
  private readonly repo: string;
  private readonly ref: string;
  private readonly token: string;
  private resolvedRef: string | null = null;

  constructor(config: BitBucketSourceConfig) {
    this.baseUrl = (config.baseUrl ?? "https://api.bitbucket.org/2.0").replace(/\/$/, "");
    this.workspace = config.workspace;
    this.repo = config.repo;
    this.ref = config.ref ?? "HEAD";
    this.token = config.token ?? process.env.BITBUCKET_TOKEN ?? "";

    if (!this.token) {
      throw new Error("BitBucket token required. Set BITBUCKET_TOKEN environment variable or pass token in config.");
    }
  }

  /**
   * Make an authenticated API request to BitBucket
   */
  private async apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`BitBucket API error: ${response.status} ${response.statusText} for ${path}`);
    }

    return response.json() as T;
  }

  /**
   * Resolve ref (branch/tag/HEAD) to commit SHA
   */
  private async resolveRefToSha(): Promise<string> {
    if (this.resolvedRef) {
      return this.resolvedRef;
    }

    let refToResolve = this.ref;

    // If ref is HEAD, get the default branch from repository info
    if (refToResolve === "HEAD") {
      const repoInfo = await this.apiRequest<{ mainbranch?: { name: string } }>(
        `/repositories/${this.workspace}/${this.repo}`
      );
      refToResolve = repoInfo.mainbranch?.name ?? "main";
    }

    try {
      // Get the commit for the ref - try as branch first
      const data = await this.apiRequest<{ target?: { hash: string }; hash?: string }>(
        `/repositories/${this.workspace}/${this.repo}/refs/branches/${encodeURIComponent(refToResolve)}`
      );
      // Branch refs have target.hash, tags might be different
      this.resolvedRef = data.target?.hash ?? data.hash ?? "";
      if (!this.resolvedRef) {
        // Try as a commit SHA directly
        const commitData = await this.apiRequest<{ hash: string }>(
          `/repositories/${this.workspace}/${this.repo}/commit/${encodeURIComponent(refToResolve)}`
        );
        this.resolvedRef = commitData.hash;
      }
      return this.resolvedRef;
    } catch (error) {
      throw new Error(
        `Failed to resolve ref "${refToResolve}" for ${this.workspace}/${this.repo}: ${error}`
      );
    }
  }

  /**
   * Get raw file contents at a specific ref (used for incremental updates)
   */
  private async readFileRaw(path: string, ref: string): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/repositories/${this.workspace}/${this.repo}/src/${encodeURIComponent(ref)}/${encodeURIComponent(path)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) {
        return null;
      }

      return response.text();
    } catch {
      return null;
    }
  }

  /**
   * Fetch all files by cloning the repository.
   * This is more efficient than using the API for larger repos and avoids rate limits.
   */
  private async fetchAllFiles(ref: string): Promise<Map<string, string>> {
    console.log(`Cloning ${this.workspace}/${this.repo}@${ref}...`);

    // Create a temporary directory for the clone
    const tempDir = await this.cloneRepository(ref);

    try {
      // Load ignore patterns from the cloned repo
      const { augmentignore, gitignore } = await this.loadIgnorePatternsFromDir(tempDir);

      const files = new Map<string, string>();

      // Walk the directory and collect files
      await this.walkDirectory(tempDir, tempDir, augmentignore, gitignore, files);

      console.log(`Collected ${files.size} files from clone`);
      return files;
    } finally {
      // Clean up the temporary directory
      await this.cleanupTempDir(tempDir);
    }
  }

  /**
   * Clone the repository to a temporary directory
   */
  private async cloneRepository(ref: string): Promise<string> {
    const { execSync } = await import("node:child_process");
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    // Create temp directory
    const tempDir = await mkdtemp(join(tmpdir(), `bitbucket-${this.workspace}-${this.repo}-`));

    // Construct clone URL with token auth
    // Format: https://x-token-auth:{token}@bitbucket.org/{workspace}/{repo}.git
    const cloneUrl = `https://x-token-auth:${this.token}@bitbucket.org/${this.workspace}/${this.repo}.git`;

    try {
      // Clone with depth 1 for efficiency, then checkout the specific ref
      execSync(`git clone --depth 1 --branch ${ref} "${cloneUrl}" "${tempDir}"`, {
        stdio: "pipe",
        timeout: 300000, // 5 minute timeout
      });
    } catch {
      // If branch clone fails, try cloning default branch and checking out the ref
      try {
        execSync(`git clone --depth 1 "${cloneUrl}" "${tempDir}"`, {
          stdio: "pipe",
          timeout: 300000,
        });
        // Fetch the specific ref
        execSync(`git fetch origin ${ref}`, {
          cwd: tempDir,
          stdio: "pipe",
          timeout: 300000,
        });
        execSync(`git checkout ${ref}`, {
          cwd: tempDir,
          stdio: "pipe",
        });
      } catch (error) {
        // Clean up on failure
        await this.cleanupTempDir(tempDir);
        throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return tempDir;
  }

  /**
   * Load ignore patterns from the cloned directory
   */
  private async loadIgnorePatternsFromDir(dir: string): Promise<{ augmentignore: Ignore; gitignore: Ignore }> {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const augmentignore = ignore();
    const gitignore = ignore();

    // Load .gitignore if exists
    try {
      const gitignoreContent = await readFile(join(dir, ".gitignore"), "utf-8");
      gitignore.add(gitignoreContent);
    } catch {
      // .gitignore doesn't exist
    }

    // Load .augmentignore if exists
    try {
      const augmentignoreContent = await readFile(join(dir, ".augmentignore"), "utf-8");
      augmentignore.add(augmentignoreContent);
    } catch {
      // .augmentignore doesn't exist
    }

    return { augmentignore, gitignore };
  }

  /** Default directories to always skip */
  private static readonly SKIP_DIRS = new Set([".git", "node_modules", "__pycache__", ".venv", "venv"]);

  /**
   * Recursively walk directory and collect files
   */
  private async walkDirectory(
    rootDir: string,
    currentDir: string,
    augmentignore: Ignore,
    gitignore: Ignore,
    files: Map<string, string>
  ): Promise<void> {
    const { readdir, readFile } = await import("node:fs/promises");
    const { join, relative } = await import("node:path");

    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relativePath = relative(rootDir, fullPath);

      // Skip default ignored directories
      if (entry.isDirectory() && BitBucketSource.SKIP_DIRS.has(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Check directory against ignore patterns before descending
        const dirPath = relativePath + "/";
        if (augmentignore.ignores(dirPath) || gitignore.ignores(dirPath)) {
          continue;
        }
        await this.walkDirectory(rootDir, fullPath, augmentignore, gitignore, files);
      } else if (entry.isFile()) {
        // Apply ignore rules in priority order:
        // 1. .augmentignore (highest priority)
        if (augmentignore.ignores(relativePath)) {
          continue;
        }

        // 2. Read file content for filtering
        let content: Buffer;
        try {
          content = await readFile(fullPath);
        } catch {
          continue; // Skip files we can't read
        }

        // 3. Apply built-in filters (binary, large files, secrets)
        const filterResult = shouldFilterFile({
          path: relativePath,
          content,
        });

        if (filterResult.filtered) {
          continue;
        }

        // 4. .gitignore (lowest priority)
        if (gitignore.ignores(relativePath)) {
          continue;
        }

        // File passed all filters
        files.set(relativePath, content.toString("utf-8"));
      }
    }
  }

  /**
   * Clean up temporary directory
   */
  private async cleanupTempDir(dir: string): Promise<void> {
    const { rm } = await import("node:fs/promises");
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Check if the push was a force push (base commit not reachable from head)
   */
  private async isForcePush(base: string, head: string): Promise<boolean> {
    try {
      // BitBucket diff API - if base is not an ancestor, it's a force push
      interface DiffStatResponse {
        values: Array<{ status: string }>;
      }

      const data = await this.apiRequest<DiffStatResponse>(
        `/repositories/${this.workspace}/${this.repo}/diffstat/${encodeURIComponent(base)}..${encodeURIComponent(head)}`
      );

      // If we get here without error, the commits are comparable
      // Check if base is behind head by trying reverse
      if (data.values.length === 0) {
        // No changes between commits - check if they're the same
        if (base !== head) {
          return true; // Different commits but no forward diff = force push
        }
      }

      return false;
    } catch {
      // If comparison fails, it's likely a force push
      return true;
    }
  }

  /**
   * Check if ignore files changed between commits
   */
  private async ignoreFilesChanged(base: string, head: string): Promise<boolean> {
    interface DiffStatResponse {
      values: Array<{ new?: { path: string }; old?: { path: string } }>;
    }

    const data = await this.apiRequest<DiffStatResponse>(
      `/repositories/${this.workspace}/${this.repo}/diffstat/${encodeURIComponent(base)}..${encodeURIComponent(head)}`
    );

    const ignoreFiles = [".gitignore", ".augmentignore"];
    return (data.values || []).some((diff) =>
      ignoreFiles.includes(diff.new?.path ?? "") || ignoreFiles.includes(diff.old?.path ?? "")
    );
  }

  async fetchAll(): Promise<FileEntry[]> {
    const ref = await this.resolveRefToSha();
    const filesMap = await this.fetchAllFiles(ref);

    const files: FileEntry[] = [];
    for (const [path, contents] of filesMap) {
      files.push({ path, contents });
    }

    return files;
  }

  async fetchChanges(previous: SourceMetadata): Promise<FileChanges | null> {
    // Need previous resolved ref to compute changes
    const previousRef =
      previous.type === "github" ||
      previous.type === "gitlab" ||
      previous.type === "bitbucket"
        ? previous.resolvedRef
        : undefined;

    if (!previousRef) {
      return null;
    }

    const currentRef = await this.resolveRefToSha();

    // Same commit, no changes
    if (previousRef === currentRef) {
      return { added: [], modified: [], removed: [] };
    }

    // Check for force push
    if (await this.isForcePush(previousRef, currentRef)) {
      console.log("Force push detected, triggering full re-index");
      return null;
    }

    // Check if ignore files changed
    if (await this.ignoreFilesChanged(previousRef, currentRef)) {
      console.log("Ignore files changed, triggering full re-index");
      return null;
    }

    // Get changed files via diffstat API
    interface DiffStatResponse {
      values: Array<{
        status: string;
        new?: { path: string };
        old?: { path: string };
      }>;
    }

    const data = await this.apiRequest<DiffStatResponse>(
      `/repositories/${this.workspace}/${this.repo}/diffstat/${encodeURIComponent(previousRef)}..${encodeURIComponent(currentRef)}`
    );

    const changedFiles = data.values || [];

    // If too many changes, do full reindex
    if (changedFiles.length > 100) {
      console.log(`Too many changes (${changedFiles.length}), triggering full re-index`);
      return null;
    }

    const added: FileEntry[] = [];
    const modified: FileEntry[] = [];
    const removed: string[] = [];

    for (const file of changedFiles) {
      if (file.status === "removed") {
        if (file.old?.path) {
          removed.push(file.old.path);
        }
      } else {
        const filePath = file.new?.path;
        if (filePath) {
          // Download file contents
          const contents = await this.readFileRaw(filePath, currentRef);
          if (contents !== null) {
            const entry = { path: filePath, contents };
            if (file.status === "added") {
              added.push(entry);
            } else {
              modified.push(entry);
            }
          }

          // Handle rename as remove + add
          if (file.status === "renamed" && file.old?.path && file.old.path !== filePath) {
            removed.push(file.old.path);
          }
        }
      }
    }

    return { added, modified, removed };
  }

  async getMetadata(): Promise<SourceMetadata> {
    const resolvedRef = await this.resolveRefToSha();
    return {
      type: "bitbucket",
      config: {
        workspace: this.workspace,
        repo: this.repo,
        baseUrl: this.baseUrl !== "https://api.bitbucket.org/2.0" ? this.baseUrl : undefined,
        ref: this.ref,
      },
      resolvedRef,
      syncedAt: isoTimestamp(),
    };
  }

  async listFiles(directory: string = ""): Promise<FileInfo[]> {
    const sha = await this.resolveRefToSha();

    // Use src endpoint for specific directory (non-recursive)
    interface SrcResponse {
      values: Array<{ path: string; type: string }>;
      next?: string;
    }

    const results: FileInfo[] = [];
    let url = `/repositories/${this.workspace}/${this.repo}/src/${encodeURIComponent(sha)}/${directory}?pagelen=100`;

    try {
      // Paginate through all items in this directory (but don't recurse into subdirectories)
      while (url) {
        const data = await this.apiRequest<SrcResponse>(url);

        for (const item of data.values) {
          results.push({
            path: item.path,
            type: item.type === "commit_directory" ? "directory" as const : "file" as const,
          });
        }

        // Get next page URL (relative path)
        url = data.next ? data.next.replace(this.baseUrl, "") : "";
      }

      return results;
    } catch {
      // Directory doesn't exist
      return [];
    }
  }

  async readFile(path: string): Promise<string | null> {
    const ref = await this.resolveRefToSha();
    return this.readFileRaw(path, ref);
  }
}
