#!/usr/bin/env python3
"""
Prompt Enhancer Server Example

An HTTP server that enhances user prompts using the Augment Generation API.
This demonstrates how to use the generation API to intelligently improve user prompts.

The prompt enhancer:
1. Takes a user's prompt
2. Uses the generation API to enhance the prompt
3. Parses the enhanced prompt from the AI response
4. Returns the improved, more specific prompt

Usage:
    python main.py [workspace-directory]
    python -m prompt_enhancer_server [workspace-directory]

Endpoints:
    POST /enhance - Enhance a prompt (body: {"prompt": "..."})
    GET  /health  - Health check
"""

import json
import re
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import urlparse

from auggie_sdk.context import FileSystemContext

PORT = 3001

# Regex for extracting enhanced prompt from AI response
ENHANCED_PROMPT_REGEX = re.compile(r"<enhanced-prompt>(.*?)</enhanced-prompt>", re.DOTALL)


# --- Response Parser ---


def parse_enhanced_prompt(response: str) -> str | None:
    """
    Parse the enhanced prompt from the AI response

    Args:
        response: The AI response containing the enhanced prompt

    Returns:
        The enhanced prompt text, or None if not found
    """
    match = ENHANCED_PROMPT_REGEX.search(response)
    if match and match.group(1):
        return match.group(1).strip()
    return None


# --- Enhance Handler ---


class EnhanceResponse(TypedDict):
    """Response type for enhance requests"""

    original: str
    enhanced: str


def handle_enhance(prompt: str, context: FileSystemContext) -> EnhanceResponse:
    """
    Handle prompt enhancement request using search_and_ask

    Args:
        prompt: The original prompt to enhance
        context: FileSystemContext instance

    Returns:
        EnhanceResponse with original and enhanced prompts
    """
    print(f'\n[{datetime.now().isoformat()}] Enhancing prompt: "{prompt}"')

    # Build the enhancement instruction
    enhancement_prompt = (
        "Here is an instruction that I'd like to give you, but it needs to be improved. "
        "Rewrite and enhance this instruction to make it clearer, more specific, "
        "less ambiguous, and correct any mistakes. "
        "If there is code in triple backticks (```) consider whether it is a code sample "
        "and should remain unchanged. "
        "Reply with the following format:\n\n"
        "### BEGIN RESPONSE ###\n"
        "Here is an enhanced version of the original instruction that is more specific and clear:\n"
        "<enhanced-prompt>enhanced prompt goes here</enhanced-prompt>\n\n"
        "### END RESPONSE ###\n\n"
        "Here is my original instruction:\n\n"
        f"{prompt}"
    )

    # Use search_and_ask to get the enhancement with relevant codebase context
    response = context.search_and_ask(prompt, enhancement_prompt)

    # Parse the enhanced prompt from the response
    enhanced = parse_enhanced_prompt(response)
    if not enhanced:
        raise ValueError("Failed to parse enhanced prompt from response")

    return {
        "original": prompt,
        "enhanced": enhanced,
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
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json_response(self, status: int, data: dict[str, Any]):
        """Send a JSON response"""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def do_POST(self):
        """Handle POST requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/enhance":
            self._handle_enhance()
        else:
            self._send_json_response(404, {"error": "Not found"})

    def _handle_enhance(self):
        """Handle enhance endpoint"""
        if context is None:
            self._send_json_response(503, {"error": "Context not initialized yet"})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")

        try:
            data = json.loads(body)
            prompt = data.get("prompt")

            if not prompt or not isinstance(prompt, str):
                self._send_json_response(400, {"error": "Missing or invalid 'prompt' field"})
                return

            result = handle_enhance(prompt, context)
            self._send_json_response(200, result)
        except Exception as error:
            print(f"Enhancement error: {error}")
            self._send_json_response(500, {"error": str(error)})

    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/health":
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

    print("=== Prompt Enhancer Server ===\n")
    print(f"Workspace directory: {workspace_dir}")
    print(f"Starting server on port {PORT}...\n")

    server = None
    try:
        initialize_context()

        server = HTTPServer(("", PORT), RequestHandler)
        print(f"✅ Server running at http://localhost:{PORT}/")
        print("\nExample requests:")
        print(
            f'  curl -X POST http://localhost:{PORT}/enhance '
            f'-H "Content-Type: application/json" '
            f'-d \'{{"prompt": "fix the bug"}}\''
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
        if context:
            context.close()
        if server:
            server.server_close()
        sys.exit(1)


if __name__ == "__main__":
    main()
