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
      const signature = req.headers["x-hub-signature-256"];
      const eventType = req.headers["x-github-event"];

      if (!signature || !eventType) {
        res.status(400).json({ error: "Missing required headers" });
        return;
      }

      // Reject multi-valued headers (Express headers can be string | string[])
      if (Array.isArray(signature) || Array.isArray(eventType)) {
        res.status(400).json({ error: "Invalid headers: duplicate values not allowed" });
        return;
      }

      // Signature verification requires the raw body bytes.
      // JSON.stringify(req.body) won't match GitHub's original payload bytes
      // (due to key ordering, whitespace, unicode escaping differences).
      // Require Buffer (express.raw()) or string body.
      let body: string;
      if (Buffer.isBuffer(req.body)) {
        body = req.body.toString("utf-8");
      } else if (typeof req.body === "string") {
        body = req.body;
      } else {
        res.status(400).json({
          error: "Raw body required for signature verification. Use express.raw() middleware.",
        });
        return;
      }

      const valid = await verifyWebhookSignature(body, signature, config.secret);
      if (!valid) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const payload = JSON.parse(body) as PushEvent;

      const result = await handler(eventType, payload);

      const status = result.status === "error" ? 500 : 200;
      res.status(status).json(result);
    } catch (error) {
      next(error);
    }
  };
}

