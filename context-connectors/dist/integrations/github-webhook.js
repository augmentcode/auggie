import { Indexer } from "../core/indexer.js";
import { GitHubSource } from "../sources/github.js";
/**
 * Verify GitHub webhook signature
 */
export async function verifyWebhookSignature(payload, signature, secret) {
    const crypto = await import("crypto");
    const expected = "sha256=" +
        crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    // timingSafeEqual requires buffers of the same length
    if (sigBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}
/**
 * Create a GitHub webhook handler
 */
export function createGitHubWebhookHandler(config) {
    const defaultGetKey = (repo, ref) => {
        const branch = ref.replace("refs/heads/", "").replace("refs/tags/", "");
        return `${repo}/${branch}`;
    };
    const defaultShouldIndex = (event) => {
        // Don't index deletions
        if (event.deleted)
            return false;
        // Only index branch pushes (not tags by default)
        if (!event.ref.startsWith("refs/heads/"))
            return false;
        return true;
    };
    return async function handleWebhook(eventType, payload) {
        // Only handle push events
        if (eventType !== "push") {
            return {
                status: "skipped",
                message: `Event type "${eventType}" not handled`,
            };
        }
        const getKey = config.getKey ?? defaultGetKey;
        const shouldIndex = config.shouldIndex ?? defaultShouldIndex;
        const key = getKey(payload.repository.full_name, payload.ref);
        // Handle branch deletion
        if (payload.deleted) {
            if (config.deleteOnBranchDelete) {
                await config.store.delete(key);
                return { status: "deleted", key, message: `Deleted index for ${key}` };
            }
            return { status: "skipped", key, message: "Branch deleted, index preserved" };
        }
        // Check if we should index
        if (!shouldIndex(payload)) {
            return { status: "skipped", key, message: "Filtered by shouldIndex" };
        }
        try {
            const source = new GitHubSource({
                owner: payload.repository.owner.login,
                repo: payload.repository.name,
                ref: payload.after,
            });
            const indexer = new Indexer();
            const result = await indexer.index(source, config.store, key);
            await config.onIndexed?.(key, result);
            return {
                status: "indexed",
                key,
                message: `Indexed ${result.filesIndexed} files`,
                filesIndexed: result.filesIndexed,
            };
        }
        catch (error) {
            await config.onError?.(error, payload);
            return {
                status: "error",
                key,
                message: error.message,
            };
        }
    };
}
//# sourceMappingURL=github-webhook.js.map