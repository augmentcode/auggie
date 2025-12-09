#!/usr/bin/env node
/**
 * Prompt Enhancer Server Sample
 *
 * An HTTP server that enhances user prompts using the Augment Generation API.
 * This demonstrates how to use the actual prompt enhancer template from beachhead
 * along with the generation API to intelligently improve user prompts.
 *
 * The prompt enhancer:
 * 1. Takes a user's prompt
 * 2. Uses the beachhead prompt template to create an enhancement request
 * 3. Calls the generation API to enhance the prompt
 * 4. Parses the enhanced prompt from the AI response
 * 5. Returns the improved, more specific prompt
 *
 * Usage:
 *   npm run build
 *   node dist/samples/prompt-enhancer-server.js [workspace-directory]
 *
 * Or with tsx:
 *   npx tsx samples/prompt-enhancer-server/index.ts [workspace-directory]
 *
 * Then use curl to enhance prompts:
 *   curl -X POST http://localhost:3001/enhance \
 *     -H "Content-Type: application/json" \
 *     -d '{"prompt": "fix the bug"}'
 */

import { createServer } from "node:http";
import { FileSystemContext } from "@augmentcode/auggie-sdk";
import { handleEnhance } from "./enhance-handler";

const PORT = 3001;
const workspaceDir = process.argv[2] || process.cwd();

console.log("=== Prompt Enhancer Server ===\n");
console.log(`Workspace directory: ${workspaceDir}`);
console.log(`Starting server on port ${PORT}...\n`);

// Create FileSystem Context
let context: FileSystemContext;

async function initializeContext() {
  console.log("Initializing FileSystem Context...");
  context = await FileSystemContext.create({
    directory: workspaceDir,
    debug: false,
  });
  console.log("FileSystem Context initialized\n");
}

// HTTP request handler
const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/enhance" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const prompt = data.prompt;

        if (!prompt || typeof prompt !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Missing or invalid 'prompt' field",
            })
          );
          return;
        }

        const result = await handleEnhance(prompt, context);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error("Enhancement error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });
  } else if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        workspace: workspaceDir,
      })
    );
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

// Initialize and start server
initializeContext()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}/`);
      console.log("\nExample requests:");
      console.log(
        `  curl -X POST http://localhost:${PORT}/enhance -H "Content-Type: application/json" -d '{"prompt": "fix the bug"}'`
      );
      console.log(`  curl "http://localhost:${PORT}/health"`);
      console.log("\nPress Ctrl+C to stop\n");
    });
  })
  .catch((error) => {
    console.error("Failed to initialize:", error);
    process.exit(1);
  });

// Cleanup on exit
process.on("SIGINT", async () => {
  console.log("\n\nShutting down...");
  if (context) {
    await context.close();
  }
  server.close();
  process.exit(0);
});
