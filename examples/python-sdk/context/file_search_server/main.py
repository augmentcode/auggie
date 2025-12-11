#!/usr/bin/env python3
"""
File Search Server Example

A simple HTTP server that provides AI-powered file search using FileSystem Context.
Search results are processed with AI to summarize only the relevant results.

Usage:
    python main.py [workspace-directory]
    python -m file_search_server [workspace-directory]

Endpoints:
    GET  /search?q=<query>  - Search for files and get AI-summarized results
    GET  /health - Health check
"""

import json
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import TypedDict
from urllib.parse import parse_qs, urlparse

from auggie_sdk.context import FileSystemContext

PORT = 3000


# --- Search Handler ---


class SearchResponse(TypedDict):
    """Response type for search requests"""

    query: str
    summary: str
    formattedResults: str


def handle_search(query: str, context: FileSystemContext) -> SearchResponse:
    """
    Handle search request

    Args:
        query: Search query string
        context: FileSystemContext instance

    Returns:
        SearchResponse with query, summary, and formatted results
    """
    # Search for relevant code - returns formatted string ready for LLM use
    formatted_results = context.search(query)

    if not formatted_results or formatted_results.strip() == "":
        return {
            "query": query,
            "summary": "No relevant results found.",
            "formattedResults": "",
        }

    # Use search_and_ask to summarize the relevant results
    summary = context.search_and_ask(
        query,
        f'Provide a concise summary of the relevant results for the query "{query}". '
        "Focus only on the most relevant information.",
    )

    return {
        "query": query,
        "summary": summary,
        "formattedResults": formatted_results,
    }


# --- HTTP Server ---

# Global context
context: FileSystemContext | None = None
workspace_dir: str = "."


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
        self._send_cors_headers()
        self.end_headers()

    def _send_cors_headers(self):
        """Send CORS headers"""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json_response(self, status: int, data: dict):
        """Send a JSON response"""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        if path == "/search":
            self._handle_search(query_params)
        elif path == "/health":
            self._send_json_response(
                200,
                {
                    "status": "ok",
                    "workspace": workspace_dir,
                    "contextReady": context is not None,
                },
            )
        else:
            self._send_json_response(404, {"error": "Not found"})

    def _handle_search(self, query_params: dict):
        """Handle search endpoint"""
        query = query_params.get("q", [None])[0]

        if not query:
            self._send_json_response(400, {"error": "Missing query parameter 'q'"})
            return

        if context is None:
            self._send_json_response(503, {"error": "Context not initialized yet"})
            return

        try:
            print(f'[{datetime.now().isoformat()}] Search request: "{query}"')
            result = handle_search(query, context)
            self._send_json_response(200, result)
        except Exception as error:
            print(f"Search error: {error}")
            self._send_json_response(500, {"error": str(error)})

    def log_message(self, format, *args):
        """Override to suppress default logging"""
        pass


def main():
    """Main function"""
    global workspace_dir
    
    # Get workspace directory from command line, default to current directory
    workspace_dir_arg = sys.argv[1] if len(sys.argv) > 1 else "."
    # Resolve to absolute path to handle relative paths correctly
    workspace_dir = str(Path(workspace_dir_arg).resolve())

    print("=== File Search Server ===\n")
    print(f"Workspace directory: {workspace_dir}")
    print(f"Starting server on port {PORT}...\n")

    server = None
    try:
        initialize_context()

        server = HTTPServer(("", PORT), RequestHandler)
        print(f"✅ Server running at http://localhost:{PORT}/")
        print("\nExample requests:")
        print("  # Search with AI-summarized results")
        print(f'  curl "http://localhost:{PORT}/search?q=python"')
        print(f'  curl "http://localhost:{PORT}/search?q=authentication+logic"')
        print("\n  # Health check")
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
        if context:
            context.close()
        if server:
            server.server_close()
        sys.exit(1)


if __name__ == "__main__":
    main()
