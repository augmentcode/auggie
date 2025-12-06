/**
 * GitHub API client for fetching repository data
 * Modeled after services/integrations/github/processor/server/github_event_handler.go
 */

import { Readable } from "node:stream";
import { Octokit } from "@octokit/rest";
import ignore from "ignore";
import tar from "tar";
import { shouldFilterFile } from "./file-filter.js";
import type { FileChange } from "./types.js";

export class GitHubClient {
  private readonly octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  /**
   * Resolve a ref (like "HEAD", "main", or a commit SHA) to a commit SHA
   */
  async resolveRef(owner: string, repo: string, ref: string): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref,
      });
      return data.sha;
    } catch (error) {
      throw new Error(
        `Failed to resolve ref "${ref}" for ${owner}/${repo}: ${error}`
      );
    }
  }

  /**
   * Download repository as tarball and extract files
   * Similar to uploadBlobsFromTarball in github_event_handler.go (lines 1194-1274)
   */
  async downloadTarball(
    owner: string,
    repo: string,
    ref: string
  ): Promise<Map<string, string>> {
    console.log(`Downloading tarball for ${owner}/${repo}@${ref}...`);

    // Get tarball URL
    const { url } = await this.octokit.repos.downloadTarballArchive({
      owner,
      repo,
      ref,
    });

    // Download tarball
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download tarball: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract files from tarball
    const files = new Map<string, string>();
    const { augmentignore, gitignore } = await this.loadIgnorePatterns(
      owner,
      repo,
      ref
    );

    // Track filtering statistics
    let totalFiles = 0;
    let filteredFiles = 0;
    const filterReasons = new Map<string, number>();

    // Create a readable stream from the buffer
    const stream = Readable.from(buffer);

    // Use a promise to wait for tar extraction to complete
    await new Promise<void>((resolve, reject) => {
      const parser = tar.list({
        onentry: (entry) => {
          // Skip directories and symlinks
          if (entry.type !== "File") {
            return;
          }

          totalFiles++;

          // Remove the root directory prefix (e.g., "owner-repo-sha/")
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
              filteredFiles++;
              filterReasons.set(
                "augmentignore",
                (filterReasons.get("augmentignore") || 0) + 1
              );
              return;
            }

            // 2. Path validation, file size, keyish patterns, UTF-8 validation
            const filterResult = shouldFilterFile({
              path: filePath,
              content: contentBuffer,
            });

            if (filterResult.filtered) {
              filteredFiles++;
              const reason = filterResult.reason || "unknown";
              filterReasons.set(reason, (filterReasons.get(reason) || 0) + 1);
              return;
            }

            // 3. .gitignore (checked last)
            if (gitignore.ignores(filePath)) {
              filteredFiles++;
              filterReasons.set(
                "gitignore",
                (filterReasons.get("gitignore") || 0) + 1
              );
              return;
            }

            // File passed all filters
            const contents = contentBuffer.toString("utf-8");
            files.set(filePath, contents);
          });
        },
      });

      stream.pipe(parser);
      parser.on("close", resolve);
      stream.on("error", reject);
    });

    console.log(`Extracted ${files.size} files from tarball`);
    console.log(
      `Filtered ${filteredFiles} of ${totalFiles} files. Reasons:`,
      Object.fromEntries(filterReasons)
    );
    return files;
  }

  /**
   * Compare two commits and get file changes
   * Similar to parseCompareCommits in github_event_handler.go (lines 1707-1745)
   */
  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<{
    files: FileChange[];
    commits: number;
    totalChanges: number;
  }> {
    console.log(`Comparing ${base}...${head}...`);

    const { data } = await this.octokit.repos.compareCommits({
      owner,
      repo,
      base,
      head,
    });

    const files: FileChange[] = [];

    for (const file of data.files || []) {
      const change: FileChange = {
        path: file.filename,
        status: this.mapGitHubStatus(file.status),
        previousFilename: file.previous_filename,
      };

      // Download file contents for added/modified files
      if (change.status === "added" || change.status === "modified") {
        try {
          const contents = await this.getFileContents(
            owner,
            repo,
            file.filename,
            head
          );
          change.contents = contents;
        } catch (error) {
          console.warn(`Failed to download ${file.filename}: ${error}`);
        }
      }

      files.push(change);
    }

    return {
      files,
      commits: data.commits.length,
      totalChanges: data.files?.length || 0,
    };
  }

  /**
   * Get file contents at a specific ref
   */
  async getFileContents(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<string> {
    const { data } = await this.octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (Array.isArray(data) || data.type !== "file") {
      throw new Error(`${path} is not a file`);
    }

    // Decode base64 content
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  /**
   * Load .gitignore and .augmentignore patterns separately
   * Returns both filters to maintain proper priority order:
   * .augmentignore → keyish → .gitignore
   */
  private async loadIgnorePatterns(
    owner: string,
    repo: string,
    ref: string
  ): Promise<{
    augmentignore: ReturnType<typeof ignore>;
    gitignore: ReturnType<typeof ignore>;
  }> {
    const augmentignore = ignore();
    const gitignore = ignore();

    // Try to load .gitignore
    try {
      const gitignoreContent = await this.getFileContents(
        owner,
        repo,
        ".gitignore",
        ref
      );
      gitignore.add(gitignoreContent);
    } catch {
      // .gitignore doesn't exist
    }

    // Try to load .augmentignore
    try {
      const augmentignoreContent = await this.getFileContents(
        owner,
        repo,
        ".augmentignore",
        ref
      );
      augmentignore.add(augmentignoreContent);
    } catch {
      // .augmentignore doesn't exist
    }

    return { augmentignore, gitignore };
  }

  /**
   * Map GitHub file status to our FileChange status
   */
  private mapGitHubStatus(status: string): FileChange["status"] {
    switch (status) {
      case "added":
        return "added";
      case "modified":
        return "modified";
      case "removed":
        return "removed";
      case "renamed":
        return "renamed";
      default:
        return "modified";
    }
  }

  /**
   * Check if ignore files changed between commits
   */
  async ignoreFilesChanged(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<boolean> {
    const { data } = await this.octokit.repos.compareCommits({
      owner,
      repo,
      base,
      head,
    });

    const ignoreFiles = [".gitignore", ".augmentignore"];
    return (data.files || []).some((file) =>
      ignoreFiles.includes(file.filename)
    );
  }

  /**
   * Check if the push was a force push
   */
  async isForcePush(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<boolean> {
    try {
      await this.octokit.repos.compareCommits({
        owner,
        repo,
        base,
        head,
      });
      return false;
    } catch (_error) {
      // If comparison fails, it's likely a force push
      return true;
    }
  }
}
