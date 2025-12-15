/**
 * GitLab Source - Fetches files from GitLab repositories
 */
import type { FileEntry, FileInfo, SourceMetadata } from "../core/types.js";
import type { FileChanges, Source } from "./types.js";
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
export declare class GitLabSource implements Source {
    readonly type: "gitlab";
    private readonly baseUrl;
    private readonly projectId;
    private readonly encodedProjectId;
    private readonly ref;
    private readonly token;
    private resolvedRef;
    constructor(config: GitLabSourceConfig);
    /**
     * Make an authenticated API request to GitLab
     */
    private apiRequest;
    /**
     * Resolve ref (branch/tag/HEAD) to commit SHA
     */
    private resolveRefToSha;
    /**
     * Load ignore patterns from .gitignore and .augmentignore
     */
    private loadIgnorePatterns;
    /**
     * Get raw file contents at a specific ref
     */
    private readFileRaw;
    /**
     * Download archive and extract files
     */
    private downloadArchive;
    /**
     * Check if the push was a force push (base commit not reachable from head)
     */
    private isForcePush;
    /**
     * Check if ignore files changed between commits
     */
    private ignoreFilesChanged;
    fetchAll(): Promise<FileEntry[]>;
    fetchChanges(previous: SourceMetadata): Promise<FileChanges | null>;
    getMetadata(): Promise<SourceMetadata>;
    listFiles(): Promise<FileInfo[]>;
    readFile(path: string): Promise<string | null>;
}
//# sourceMappingURL=gitlab.d.ts.map