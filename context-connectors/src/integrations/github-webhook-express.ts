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
      // Handle Buffer (from express.raw()), string, or object
      let body: string;
      if (Buffer.isBuffer(req.body)) {
        body = req.body.toString("utf-8");
      } else if (typeof req.body === "string") {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
      }

      const valid = await verifyWebhookSignature(body, signature, config.secret);
      if (!valid) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      // Parse payload from the body string (handles Buffer, string, and object)
      const payload = (
        Buffer.isBuffer(req.body) || typeof req.body === "string"
          ? JSON.parse(body)
          : req.body
      ) as PushEvent;

      const result = await handler(eventType, payload);

      const status = result.status === "error" ? 500 : 200;
      res.status(status).json(result);
    } catch (error) {
      next(error);
    }
  };
}

