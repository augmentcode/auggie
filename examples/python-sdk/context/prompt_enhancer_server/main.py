#!/usr/bin/env python3
"""
Prompt Enhancer Server Sample

An HTTP server that enhances user prompts using the Augment Generation API.
This demonstrates how to use the actual prompt enhancer template from beachhead
along with the generation API to intelligently improve user prompts.

The prompt enhancer:
1. Takes a user's prompt
2. Uses the beachhead prompt template to create an enhancement request
3. Calls the generation API to enhance the prompt
4. Parses the enhanced prompt from the AI response
5. Returns the improved, more specific prompt

Usage:
    python examples/context/prompt_enhancer_server/main.py [workspace-directory]

Then use curl to enhance prompts:
    curl -X POST http://localhost:3001/enhance \
      -H "Content-Type: application/json" \
      -d '{"prompt": "fix the bug"}'
"""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from auggie_sdk.context import FileSystemContext
from enhance_handler import handle_enhance

PORT = 3001
# Get workspace directory from command line, default to current directory
workspace_dir_arg = sys.argv[1] if len(sys.argv) > 1 else "."
# Resolve to absolute path to handle relative paths correctly
workspace_dir = str(Path(workspace_dir_arg).resolve())

print("=== Prompt Enhancer Server ===\n")
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
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        """Handle POST requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/enhance":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")

            try:
                data = json.loads(body)
                prompt = data.get("prompt")

                if not prompt or not isinstance(prompt, str):
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
                    self.send_header("Access-Control-Allow-Headers", "Content-Type")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({"error": "Missing or invalid 'prompt' field"}).encode()
                    )
                    return

                result = handle_enhance(prompt, context)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()
                self.wfile.write(json.dumps(result, indent=2).encode())
            except Exception as error:
                print(f"Enhancement error: {error}")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(error)}).encode())
        else:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode())

    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {
                        "status": "ok",
                        "workspace": workspace_dir,
                    }
                ).encode()
            )
        else:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
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
        print(
            f'  curl -X POST http://localhost:{PORT}/enhance -H "Content-Type: application/json" -d \'{{\"prompt\": \"fix the bug\"}}\''
        )
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

