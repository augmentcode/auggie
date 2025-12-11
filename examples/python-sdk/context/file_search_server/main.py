#!/usr/bin/env python3
"""
File Search Server Sample

A simple HTTP server that provides AI-powered file search using FileSystem Context.
Search results are processed with AI to summarize only the relevant results.

Usage:
    python examples/context/file_search_server/main.py [workspace-directory]

Endpoints:
    GET  /search?q=<query>  - Search for files and get AI-summarized results
    GET  /health - Health check
"""

import json
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from auggie_sdk.context import FileSystemContext
from search_handler import handle_search

PORT = 3000
# Get workspace directory from command line, default to current directory
workspace_dir_arg = sys.argv[1] if len(sys.argv) > 1 else "."
# Resolve to absolute path to handle relative paths correctly
workspace_dir = str(Path(workspace_dir_arg).resolve())

print("=== File Search Server ===\n")
print(f"Workspace directory: {workspace_dir}")
print(f"Starting server on port {PORT}...\n")

# Create FileSystem Context
context: FileSystemContext | None = None


def initialize_context():
    """Initialize the FileSystem Context"""
    global context
    print("Initializing FileSystem Context...")
    context = FileSystemContext.create(workspace_dir, debug=False)
    print("FileSystem Context initialized\n")


class RequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler"""

    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        if path == "/search":
            query = query_params.get("q", [None])[0]

            if not query:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"error": "Missing query parameter 'q'"}).encode()
                )
                return

            if context is None:
                self.send_response(503)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"error": "Context not initialized yet"}).encode()
                )
                return

            try:
                print(f"[{datetime.now().isoformat()}] Search request: \"{query}\"")

                result = handle_search(query, context)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()
                self.wfile.write(json.dumps(result, indent=2).encode())
            except Exception as error:
                print(f"Search error: {error}")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(error)}).encode())

        elif path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {
                        "status": "ok",
                        "workspace": workspace_dir,
                        "contextReady": context is not None,
                    }
                ).encode()
            )

        else:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode())

    def log_message(self, format, *args):
        """Override to suppress default logging"""
        pass


def main():
    """Main function"""
    server = None
    try:
        initialize_context()

        server = HTTPServer(("", PORT), RequestHandler)
        print(f"✅ Server running at http://localhost:{PORT}/")
        print("\nExample requests:")
        print(f"  # Search with AI-summarized results")
        print(f'  curl "http://localhost:{PORT}/search?q=python"')
        print(f'  curl "http://localhost:{PORT}/search?q=authentication+logic"')
        print(f"\n  # Health check")
        print(f'  curl "http://localhost:{PORT}/health"')
        print("\nPress Ctrl+C to stop\n")

        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\nShutting down...")
        if context:
            context.close()
        if server:
            server.server_close()
        print("Server stopped")
        sys.exit(0)
    except Exception as error:
        print(f"Failed to initialize: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()

