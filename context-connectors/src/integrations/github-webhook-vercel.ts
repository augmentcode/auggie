import {
  createGitHubWebhookHandler,
  verifyWebhookSignature,
  type GitHubWebhookConfig,
  type PushEvent,
} from "./github-webhook.js";

type VercelRequest = {
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
};

type VercelResponse = Response;

export function createVercelHandler(config: GitHubWebhookConfig) {
  const handler = createGitHubWebhookHandler(config);

  return async function POST(request: VercelRequest): Promise<VercelResponse> {
    const signature = request.headers.get("x-hub-signature-256");
    const eventType = request.headers.get("x-github-event");

    if (!signature || !eventType) {
      return Response.json(
        { error: "Missing required headers" },
        { status: 400 }
      );
    }

    const body = await request.text();

    const valid = await verifyWebhookSignature(body, signature, config.secret);
    if (!valid) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body) as PushEvent;
    const result = await handler(eventType, payload);

    const status = result.status === "error" ? 500 : 200;
    return Response.json(result, { status });
  };
}

