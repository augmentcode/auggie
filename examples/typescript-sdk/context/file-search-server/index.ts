#!/usr/bin/env node
/**
 * File Search Server Sample
 *
 * A simple HTTP server that provides AI-powered file search using FileSystem Context.
 * Search results are processed with Haiku 4.5 to summarize only the relevant results.
 *
 * Usage:
 *   npm run build
 *   node dist/examples/context/file-search-server/index.js [workspace-directory]
 *
 * Or with tsx:
 *   npx tsx examples/context/file-search-server/index.ts [workspace-directory]
 *
 * Endpoints:
 *   GET  /search?q=<query>  - Search for files and get AI-summarized results
 *   GET  /health - Health check
 */

import { createServer } from "node:http";
import { FileSystemContext } from "@augmentcode/auggie-sdk";
import { handleSearch } from "./search-handler";

const PORT = 3000;
const workspaceDir = process.argv[2] || process.cwd();

console.log("=== File Search Server ===\n");
console.log(`Workspace directory: ${workspaceDir}`);
console.log(`Starting server on port ${PORT}...\n`);

// Create FileSystem Context
let context: FileSystemContext | null = null;

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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/search" && req.method === "GET") {
    const query = url.searchParams.get("q");

    if (!query) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing query parameter 'q'" }));
      return;
    }

    if (!context) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Context not initialized yet" }));
      return;
    }

    try {
      console.log(`[${new Date().toISOString()}] Search request: "${query}"`);

      const result = await handleSearch(query, context);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("Search error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  } else if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        workspace: workspaceDir,
        contextReady: context !== null,
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
      console.log("  # Search with AI-summarized results");
      console.log(`  curl "http://localhost:${PORT}/search?q=typescript"`);
      console.log(
        `  curl "http://localhost:${PORT}/search?q=authentication+logic"`
      );
      console.log("\n  # Health check");
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
