/**
 * Index Manager - Core indexing logic
 */

import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { DirectContext } from "@augmentcode/auggie-sdk";
import { GitHubClient } from "./github-client.js";
import type {
  FileChange,
  IndexConfig,
  IndexResult,
  IndexState,
} from "./types.js";

const DEFAULT_MAX_COMMITS = 100;
const DEFAULT_MAX_FILES = 500;

export class IndexManager {
  private readonly github: GitHubClient;
  private context: DirectContext;
  private readonly config: IndexConfig;
  private readonly statePath: string;

  constructor(context: DirectContext, config: IndexConfig, statePath: string) {
    this.context = context;
    this.config = config;
    this.statePath = statePath;
    this.github = new GitHubClient(config.githubToken);
  }

  /**
   * Resolve the current commit ref to an actual commit SHA
   * This handles cases where GITHUB_SHA might be "HEAD" or a branch name
   */
  async resolveCommitSha(): Promise<void> {
    const resolvedSha = await this.github.resolveRef(
      this.config.owner,
      this.config.repo,
      this.config.currentCommit
    );
    this.config.currentCommit = resolvedSha;
  }

  /**
   * Load index state from file system
   *
   * EXTENDING TO OTHER STORAGE BACKENDS:
   * Replace this method to load state from your preferred storage:
   * - Redis: Use ioredis client to GET the state JSON
   * - S3: Use AWS SDK to getObject from S3 bucket
   * - Database: Query your database for the state record
   *
   * Example for Redis:
   *   const redis = new Redis(redisUrl);
   *   const data = await redis.get(stateKey);
   *   return data ? JSON.parse(data) : null;
   *
   * Example for S3:
   *   const s3 = new S3Client({ region });
   *   const response = await s3.send(new GetObjectCommand({ Bucket, Key }));
   *   const data = await response.Body.transformToString();
   *   return JSON.parse(data);
   */
  private async loadState(): Promise<IndexState | null> {
    try {
      const data = await fs.readFile(this.statePath, "utf-8");
      return JSON.parse(data) as IndexState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Save index state to file system
   *
   * EXTENDING TO OTHER STORAGE BACKENDS:
   * Replace this method to save state to your preferred storage:
   * - Redis: Use ioredis client to SET the state JSON
   * - S3: Use AWS SDK to putObject to S3 bucket
   * - Database: Insert or update the state record in your database
   *
   * Example for Redis:
   *   const redis = new Redis(redisUrl);
   *   await redis.set(stateKey, JSON.stringify(state));
   *
   * Example for S3:
   *   const s3 = new S3Client({ region });
   *   await s3.send(new PutObjectCommand({
   *     Bucket,
   *     Key,
   *     Body: JSON.stringify(state),
   *     ContentType: 'application/json'
   *   }));
   *
   * Note: The state is just a JSON object (IndexState type) that can be
   * serialized and stored anywhere. For distributed systems, consider using
   * Redis or a database for shared state across multiple workers.
   */
  private async saveState(state: IndexState): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(dirname(this.statePath), { recursive: true });

    // Write state to file
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), "utf-8");
  }

  /**
   * Main indexing entry point
   */
  async index(): Promise<IndexResult> {
    console.log(
      `Starting index for ${this.config.owner}/${this.config.repo}@${this.config.branch}`
    );

    try {
      // Load previous state
      const previousState = await this.loadState();

      // If we have previous state, we'll need to create a new context with the imported state
      // For now, we'll handle this in the incremental update logic

      // Determine if we need full re-index
      const shouldFullReindex = await this.shouldFullReindex(previousState);

      if (shouldFullReindex.should) {
        return await this.fullReindex(shouldFullReindex.reason);
      }

      // Perform incremental update
      // previousState is guaranteed to be non-null here because shouldFullReindex checks for it
      if (!previousState) {
        throw new Error("previousState should not be null at this point");
      }
      return await this.incrementalUpdate(previousState);
    } catch (error) {
      console.error("Indexing failed:", error);
      return {
        success: false,
        type: "full",
        filesIndexed: 0,
        filesDeleted: 0,
        checkpointId: "",
        commitSha: this.config.currentCommit,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Determine if full re-index is needed
   */
  private async shouldFullReindex(
    previousState: IndexState | null
  ): Promise<{ should: boolean; reason?: string }> {
    // No previous state - first run
    if (!previousState) {
      return { should: true, reason: "first_run" };
    }

    // Different repository
    if (
      previousState.repository.owner !== this.config.owner ||
      previousState.repository.name !== this.config.repo
    ) {
      return { should: true, reason: "different_repository" };
    }

    // Same commit - no changes
    if (previousState.lastCommitSha === this.config.currentCommit) {
      console.log("No changes detected");
      return { should: false };
    }

    // Check for force push
    const isForcePush = await this.github.isForcePush(
      this.config.owner,
      this.config.repo,
      previousState.lastCommitSha,
      this.config.currentCommit
    );

    if (isForcePush) {
      return { should: true, reason: "force_push" };
    }

    // Get comparison
    const comparison = await this.github.compareCommits(
      this.config.owner,
      this.config.repo,
      previousState.lastCommitSha,
      this.config.currentCommit
    );

    // Too many commits
    const maxCommits = this.config.maxCommits || DEFAULT_MAX_COMMITS;
    if (comparison.commits > maxCommits) {
      return {
        should: true,
        reason: `too_many_commits (${comparison.commits} > ${maxCommits})`,
      };
    }

    // Too many file changes
    const maxFiles = this.config.maxFiles || DEFAULT_MAX_FILES;
    if (comparison.totalChanges > maxFiles) {
      return {
        should: true,
        reason: `too_many_files (${comparison.totalChanges} > ${maxFiles})`,
      };
    }

    // Check if ignore files changed
    const ignoreChanged = await this.github.ignoreFilesChanged(
      this.config.owner,
      this.config.repo,
      previousState.lastCommitSha,
      this.config.currentCommit
    );

    if (ignoreChanged) {
      return { should: true, reason: "ignore_files_changed" };
    }

    return { should: false };
  }

  /**
   * Perform full repository re-index
   */
  private async fullReindex(reason?: string): Promise<IndexResult> {
    console.log(`Performing full re-index (reason: ${reason || "unknown"})`);

    // Download entire repository as tarball
    const files = await this.github.downloadTarball(
      this.config.owner,
      this.config.repo,
      this.config.currentCommit
    );

    // Add all files to index
    const filesToIndex = Array.from(files.entries()).map(
      ([path, contents]) => ({
        path,
        contents,
      })
    );

    console.log(`Adding ${filesToIndex.length} files to index...`);
    await this.context.addToIndex(filesToIndex);

    // Export DirectContext state
    const contextState = this.context.export();

    const newState: IndexState = {
      contextState,
      lastCommitSha: this.config.currentCommit,
      repository: {
        owner: this.config.owner,
        name: this.config.repo,
      },
    };

    // Save state
    await this.saveState(newState);

    return {
      success: true,
      type: "full",
      filesIndexed: filesToIndex.length,
      filesDeleted: 0,
      checkpointId: contextState.checkpointId || "",
      commitSha: this.config.currentCommit,
      reindexReason: reason,
    };
  }

  /**
   * Process added or modified file
   */
  private processAddedOrModifiedFile(
    change: FileChange,
    filesToAdd: Array<{ path: string; contents: string }>
  ): void {
    if (change.contents) {
      filesToAdd.push({ path: change.path, contents: change.contents });
    }
  }

  /**
   * Process renamed file
   */
  private processRenamedFile(
    change: FileChange,
    filesToAdd: Array<{ path: string; contents: string }>,
    filesToDelete: string[]
  ): void {
    if (change.previousFilename) {
      filesToDelete.push(change.previousFilename);
    }
    if (change.contents) {
      filesToAdd.push({ path: change.path, contents: change.contents });
    }
  }

  /**
   * Process file changes and categorize them for indexing
   */
  private processFileChanges(changes: FileChange[]): {
    filesToAdd: Array<{ path: string; contents: string }>;
    filesToDelete: string[];
  } {
    const filesToAdd: Array<{ path: string; contents: string }> = [];
    const filesToDelete: string[] = [];

    for (const change of changes) {
      if (change.status === "added" || change.status === "modified") {
        this.processAddedOrModifiedFile(change, filesToAdd);
      } else if (change.status === "removed") {
        filesToDelete.push(change.path);
      } else if (change.status === "renamed") {
        this.processRenamedFile(change, filesToAdd, filesToDelete);
      }
    }

    return { filesToAdd, filesToDelete };
  }

  /**
   * Apply file changes to the index
   */
  private async applyChangesToIndex(
    filesToAdd: Array<{ path: string; contents: string }>,
    filesToDelete: string[]
  ): Promise<void> {
    if (filesToAdd.length > 0) {
      await this.context.addToIndex(filesToAdd);
    }

    if (filesToDelete.length > 0) {
      await this.context.removeFromIndex(filesToDelete);
    }
  }

  /**
   * Create new index state after update
   */
  private createNewState(previousState: IndexState): IndexState {
    const contextState = this.context.export();

    return {
      contextState,
      lastCommitSha: this.config.currentCommit,
      repository: previousState.repository,
    };
  }

  /**
   * Perform incremental update
   */
  private async incrementalUpdate(
    previousState: IndexState
  ): Promise<IndexResult> {
    console.log("Performing incremental update...");

    // Import the previous context state directly
    this.context = await DirectContext.import(previousState.contextState, {
      apiKey: this.config.apiToken,
      apiUrl: this.config.apiUrl,
    });

    // Get file changes
    const comparison = await this.github.compareCommits(
      this.config.owner,
      this.config.repo,
      previousState.lastCommitSha,
      this.config.currentCommit
    );

    // Process changes
    const { filesToAdd, filesToDelete } = this.processFileChanges(
      comparison.files
    );

    console.log(
      `Adding ${filesToAdd.length} files, deleting ${filesToDelete.length} files`
    );

    // Update index
    await this.applyChangesToIndex(filesToAdd, filesToDelete);

    // Create and save new state
    const newState = this.createNewState(previousState);
    await this.saveState(newState);

    return {
      success: true,
      type: "incremental",
      filesIndexed: filesToAdd.length,
      filesDeleted: filesToDelete.length,
      checkpointId: newState.contextState.checkpointId || "",
      commitSha: this.config.currentCommit,
    };
  }
}
