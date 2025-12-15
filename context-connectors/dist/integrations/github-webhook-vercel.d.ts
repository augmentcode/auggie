import { type GitHubWebhookConfig } from "./github-webhook.js";
type VercelRequest = {
    headers: {
        get(name: string): string | null;
    };
    text(): Promise<string>;
    json(): Promise<unknown>;
};
type VercelResponse = Response;
export declare function createVercelHandler(config: GitHubWebhookConfig): (request: VercelRequest) => Promise<VercelResponse>;
export {};
//# sourceMappingURL=github-webhook-vercel.d.ts.map