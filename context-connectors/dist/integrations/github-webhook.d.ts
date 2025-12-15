import type { IndexStore } from "../stores/types.js";
import type { IndexResult } from "../core/types.js";
export interface PushEvent {
    ref: string;
    before: string;
    after: string;
    repository: {
        full_name: string;
        owner: {
            login: string;
        };
        name: string;
        default_branch: string;
    };
    pusher: {
        name: string;
    };
    deleted: boolean;
    forced: boolean;
}
export interface GitHubWebhookConfig {
    store: IndexStore;
    secret: string;
    /** Generate index key from repo/ref. Default: "owner/repo/branch" */
    getKey?: (repo: string, ref: string) => string;
    /** Filter which pushes trigger indexing. Default: all non-delete pushes */
    shouldIndex?: (event: PushEvent) => boolean;
    /** Called after successful indexing */
    onIndexed?: (key: string, result: IndexResult) => void | Promise<void>;
    /** Called on errors */
    onError?: (error: Error, event: PushEvent) => void | Promise<void>;
    /** Delete index when branch is deleted. Default: false */
    deleteOnBranchDelete?: boolean;
}
export interface WebhookResult {
    status: "indexed" | "deleted" | "skipped" | "error";
    key?: string;
    message: string;
    filesIndexed?: number;
}
/**
 * Verify GitHub webhook signature
 */
export declare function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean>;
/**
 * Create a GitHub webhook handler
 */
export declare function createGitHubWebhookHandler(config: GitHubWebhookConfig): (eventType: string, payload: PushEvent) => Promise<WebhookResult>;
//# sourceMappingURL=github-webhook.d.ts.map