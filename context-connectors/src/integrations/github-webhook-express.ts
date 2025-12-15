import type { Request, Response, NextFunction } from "express";
import {
  createGitHubWebhookHandler,
  verifyWebhookSignature,
  type GitHubWebhookConfig,
  type PushEvent,
} from "./github-webhook.js";

export function createExpressHandler(config: GitHubWebhookConfig) {
  const handler = createGitHubWebhookHandler(config);

  return async function middleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const signature = req.headers["x-hub-signature-256"] as string;
      const eventType = req.headers["x-github-event"] as string;

      if (!signature || !eventType) {
        res.status(400).json({ error: "Missing required headers" });
        return;
      }

      // Requires raw body - use express.raw() middleware
      const body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);

      const valid = await verifyWebhookSignature(body, signature, config.secret);
      if (!valid) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const payload = (
        typeof req.body === "string" ? JSON.parse(req.body) : req.body
      ) as PushEvent;

      const result = await handler(eventType, payload);

      const status = result.status === "error" ? 500 : 200;
      res.status(status).json(result);
    } catch (error) {
      next(error);
    }
  };
}

