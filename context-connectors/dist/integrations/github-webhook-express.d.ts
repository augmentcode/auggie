import type { Request, Response, NextFunction } from "express";
import { type GitHubWebhookConfig } from "./github-webhook.js";
export declare function createExpressHandler(config: GitHubWebhookConfig): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=github-webhook-express.d.ts.map