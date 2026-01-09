/**
 * GitLab Source - Fetches files from GitLab repositories
 */

import { Readable } from "node:stream";
import ignoreFactory, { type Ignore } from "ignore";
import tar from "tar";
import { shouldFilterFile } from "../core/file-filter.js";
import { isoTimestamp } from "../core/utils.js";
import type { FileEntry, FileInfo, SourceMetadata } from "../core/types.js";
import type { FileChanges, Source } from "./types.js";

// With NodeNext module resolution, we need to access the default export properly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ignore = (ignoreFactory as any).default ?? ignoreFactory;

/** Configuration for GitLabSource */
export interface GitLabSourceConfig {
  /** GitLab API token. Defaults to process.env.GITLAB_TOKEN */
  token?: string;
  /** GitLab base URL. Defaults to https://gitlab.com */
  baseUrl?: string;
  /** Project ID or path (e.g., "group/project" or numeric ID) */
  projectId: string;
  /** Branch/tag/commit ref. Defaults to "HEAD" */
  ref?: string;
}

export class GitLabSource implements Source {
  readonly type = "gitlab" as const;
  private readonly baseUrl: string;
  private readonly projectId: string;
  private readonly encodedProjectId: string;
  private readonly ref: string;
  private readonly token: string;
  private resolvedRef: string | null = null;

  constructor(config: GitLabSourceConfig) {
    this.baseUrl = (config.baseUrl ?? "https://gitlab.com").replace(/\/$/, "");
    this.projectId = config.projectId;
    // URL-encode the project path for API calls
    this.encodedProjectId = encodeURIComponent(config.projectId);
    this.ref = config.ref ?? "HEAD";
    this.token = config.token ?? process.env.GITLAB_TOKEN ?? "";

    if (!this.token) {
      throw new Error("GitLab token required. Set GITLAB_TOKEN environment variable or pass token in config.");
    }
  }

  /**
   * Make an authenticated API request to GitLab
   */
  private async apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v4${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "PRIVATE-TOKEN": this.token,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText} for ${path}`);
    }

    return response.json() as T;
  }

  /**
   * Make a paginated API request to GitLab, fetching all pages.
   * Uses x-next-page header to determine if more pages exist.
   */
  private async apiRequestPaginated<T>(basePath: string): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const separator = basePath.includes("?") ? "&" : "?";
      const url = `${this.baseUrl}/api/v4${basePath}${separator}per_page=${perPage}&page=${page}`;

      const response = await fetch(url, {
        headers: {
          "PRIVATE-TOKEN": this.token,
        },
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} ${response.statusText} for ${basePath}`);
      }

      const data = (await response.json()) as T[];
      results.push(...data);

      // Check if there are more pages using x-next-page header
      const nextPage = response.headers.get("x-next-page");
      if (!nextPage || nextPage === "") {
        break;
      }

      page = parseInt(nextPage, 10);
    }

    return results;
  }

  /**
   * Resolve ref (branch/tag/HEAD) to commit SHA
   */
  private async resolveRefToSha(): Promise<string> {
    if (this.resolvedRef) {
      return this.resolvedRef;
    }

    try {
      // Get the commit for the ref
      const data = await this.apiRequest<{ id: string }>(
        `/projects/${this.encodedProjectId}/repository/commits/${encodeURIComponent(this.ref)}`
      );
      this.resolvedRef = data.id;
      return data.id;
    } catch (error) {
      throw new Error(
        `Failed to resolve ref "${this.ref}" for ${this.projectId}: ${error}`
      );
    }
  }

  /**
   * Load ignore patterns from .gitignore and .augmentignore
   */
  private async loadIgnorePatterns(ref: string): Promise<{
    augmentignore: Ignore;
    gitignore: Ignore;
  }> {
    const augmentignore = ignore();
    const gitignore = ignore();

    // Try to load .gitignore
    const gitignoreContent = await this.readFileRaw(".gitignore", ref);
    if (gitignoreContent) {
      gitignore.add(gitignoreContent);
    }

    // Try to load .augmentignore
    const augmentignoreContent = await this.readFileRaw(".augmentignore", ref);
    if (augmentignoreContent) {
      augmentignore.add(augmentignoreContent);
    }

    return { augmentignore, gitignore };
  }

  /**
   * Get raw file contents at a specific ref
   */
  private async readFileRaw(path: string, ref: string): Promise<string | null> {
    try {
      const encodedPath = encodeURIComponent(path);
      const url = `${this.baseUrl}/api/v4/projects/${this.encodedProjectId}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(ref)}`;
      const response = await fetch(url, {
        headers: { "PRIVATE-TOKEN": this.token },
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
   * Download archive and extract files
   */
  private async downloadArchive(ref: string): Promise<Map<string, string>> {
    console.log(`Downloading archive for ${this.projectId}@${ref}...`);

    const url = `${this.baseUrl}/api/v4/projects/${this.encodedProjectId}/repository/archive.tar.gz?sha=${encodeURIComponent(ref)}`;
    // Note: GitLab has hotlinking protection that returns 406 for cross-origin requests.
    // Using mode: 'same-origin' works around this protection. See: https://github.com/unjs/giget/issues/97
    const response = await fetch(url, {
      headers: { "PRIVATE-TOKEN": this.token },
      mode: "same-origin",
    });

    if (!response.ok) {
      throw new Error(`Failed to download archive: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Load ignore patterns
    const { augmentignore, gitignore } = await this.loadIgnorePatterns(ref);

    // Extract files from tarball
    const files = new Map<string, string>();
    const stream = Readable.from(buffer);

    await new Promise<void>((resolve, reject) => {
      const parser = tar.list({
        onentry: (entry) => {
          // Skip directories and symlinks
          if (entry.type !== "File") {
            return;
          }

          // Remove the root directory prefix (e.g., "project-ref-sha/")
          const pathParts = entry.path.split("/");
          pathParts.shift(); // Remove first component
          const filePath = pathParts.join("/");

          // Read file contents
          const chunks: Buffer[] = [];
          entry.on("data", (chunk) => chunks.push(chunk));
          entry.on("end", () => {
            const contentBuffer = Buffer.concat(chunks);

            // Apply filtering in priority order:
            // 1. .augmentignore
            if (augmentignore.ignores(filePath)) {
              return;
            }

            // 2. Path validation, file size, keyish patterns, UTF-8 validation
            const filterResult = shouldFilterFile({
              path: filePath,
              content: contentBuffer,
            });

            if (filterResult.filtered) {
              return;
            }

            // 3. .gitignore (checked last)
            if (gitignore.ignores(filePath)) {
              return;
            }

            // File passed all filters
            const contents = contentBuffer.toString("utf-8");
            files.set(filePath, contents);
          });
          // Handle entry-level errors to prevent hanging on corrupt entries
          entry.on("error", reject);
        },
      });

      stream.pipe(parser);
      parser.on("close", resolve);
      // Handle parser errors (tar library types don't include error event, but the underlying stream does)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (parser as any).on("error", reject);
      stream.on("error", reject);
    });

    console.log(`Extracted ${files.size} files from archive`);
    return files;
  }

  /**
   * Check if the push was a force push (base commit not reachable from head)
   *
   * Force push detection cases:
   * 1. Compare API fails - base commit no longer exists
   * 2. Empty commits list with non-empty diffs - diverged histories
   * 3. compare_same_ref true but different SHAs - revert to older commit
   *
   * GitLab Compare API returns:
   * - commits: list of commits from base to head
   * - diffs: list of file diffs
   * - compare_timeout: boolean if comparison timed out
   * - compare_same_ref: true if comparing same ref
   *
   * When head is behind base (force push revert), the commits array is empty
   * but the diffs show changes because it's comparing backwards.
   */
  private async isForcePush(base: string, head: string): Promise<boolean> {
    try {
      interface CompareResult {
        commits: Array<{ id: string }>;
        diffs: Array<{ new_path: string }>;
        compare_same_ref?: boolean;
      }

      const data = await this.apiRequest<CompareResult>(
        `/projects/${this.encodedProjectId}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(head)}`
      );

      // If commits array is empty but we have diffs, it indicates diverged/behind history
      // This happens when head is an ancestor of base (revert to older commit)
      if (data.commits.length === 0 && data.diffs.length > 0) {
        return true;
      }

      // If commits array is empty and no diffs, but the refs are different,
      // this indicates head is behind base
      if (data.commits.length === 0 && base !== head) {
        // Double-check by comparing in reverse direction
        const reverseData = await this.apiRequest<CompareResult>(
          `/projects/${this.encodedProjectId}/repository/compare?from=${encodeURIComponent(head)}&to=${encodeURIComponent(base)}`
        );

        // If reverse comparison has commits, then head is behind base (force push revert)
        if (reverseData.commits.length > 0) {
          return true;
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
    const data = await this.apiRequest<{ diffs: Array<{ new_path: string }> }>(
      `/projects/${this.encodedProjectId}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(head)}`
    );

    const ignoreFiles = [".gitignore", ".augmentignore"];
    return (data.diffs || []).some((diff) =>
      ignoreFiles.includes(diff.new_path)
    );
  }

  async fetchAll(): Promise<FileEntry[]> {
    const ref = await this.resolveRefToSha();
    const filesMap = await this.downloadArchive(ref);

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

    // Get changed files via compare API
    const data = await this.apiRequest<{ diffs: Array<{ new_path: string; old_path: string; new_file: boolean; deleted_file: boolean; renamed_file: boolean }> }>(
      `/projects/${this.encodedProjectId}/repository/compare?from=${encodeURIComponent(previousRef)}&to=${encodeURIComponent(currentRef)}`
    );

    const changedFiles = data.diffs || [];

    // If too many changes, do full reindex
    if (changedFiles.length > 100) {
      console.log(`Too many changes (${changedFiles.length}), triggering full re-index`);
      return null;
    }

    const added: FileEntry[] = [];
    const modified: FileEntry[] = [];
    const removed: string[] = [];

    for (const file of changedFiles) {
      if (file.deleted_file) {
        removed.push(file.old_path);
      } else {
        // Download file contents
        const contents = await this.readFileRaw(file.new_path, currentRef);
        if (contents !== null) {
          const entry = { path: file.new_path, contents };
          if (file.new_file) {
            added.push(entry);
          } else {
            modified.push(entry);
          }
        }

        // Handle rename as remove + add
        if (file.renamed_file && file.old_path !== file.new_path) {
          removed.push(file.old_path);
        }
      }
    }

    return { added, modified, removed };
  }

  async getMetadata(): Promise<SourceMetadata> {
    const resolvedRef = await this.resolveRefToSha();
    return {
      type: "gitlab",
      config: {
        projectId: this.projectId,
        baseUrl: this.baseUrl !== "https://gitlab.com" ? this.baseUrl : undefined,
        ref: this.ref,
      },
      resolvedRef,
      syncedAt: isoTimestamp(),
    };
  }

  async listFiles(directory: string = ""): Promise<FileInfo[]> {
    const sha = await this.resolveRefToSha();

    // Use tree API without recursive=true for non-recursive listing
    // Add path parameter to list specific directory
    let url = `/projects/${this.encodedProjectId}/repository/tree?ref=${encodeURIComponent(sha)}`;
    if (directory) {
      url += `&path=${encodeURIComponent(directory)}`;
    }

    try {
      const data = await this.apiRequestPaginated<{ path: string; type: string }>(url);

      return data.map((item) => ({
        path: item.path,
        type: item.type === "tree" ? "directory" as const : "file" as const,
      }));
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
