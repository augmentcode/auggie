import { createGitHubWebhookHandler, verifyWebhookSignature, } from "./github-webhook.js";
export function createVercelHandler(config) {
    const handler = createGitHubWebhookHandler(config);
    return async function POST(request) {
        const signature = request.headers.get("x-hub-signature-256");
        const eventType = request.headers.get("x-github-event");
        if (!signature || !eventType) {
            return Response.json({ error: "Missing required headers" }, { status: 400 });
        }
        const body = await request.text();
        const valid = await verifyWebhookSignature(body, signature, config.secret);
        if (!valid) {
            return Response.json({ error: "Invalid signature" }, { status: 401 });
        }
        const payload = JSON.parse(body);
        const result = await handler(eventType, payload);
        const status = result.status === "error" ? 500 : 200;
        return Response.json(result, { status });
    };
}
//# sourceMappingURL=github-webhook-vercel.js.map