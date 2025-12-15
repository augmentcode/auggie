import { createGitHubWebhookHandler, verifyWebhookSignature, } from "./github-webhook.js";
export function createExpressHandler(config) {
    const handler = createGitHubWebhookHandler(config);
    return async function middleware(req, res, next) {
        try {
            const signature = req.headers["x-hub-signature-256"];
            const eventType = req.headers["x-github-event"];
            if (!signature || !eventType) {
                res.status(400).json({ error: "Missing required headers" });
                return;
            }
            // Requires raw body - use express.raw() middleware
            const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
            const valid = await verifyWebhookSignature(body, signature, config.secret);
            if (!valid) {
                res.status(401).json({ error: "Invalid signature" });
                return;
            }
            const payload = (typeof req.body === "string" ? JSON.parse(req.body) : req.body);
            const result = await handler(eventType, payload);
            const status = result.status === "error" ? 500 : 200;
            res.status(status).json(result);
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=github-webhook-express.js.map