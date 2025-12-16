#!/usr/bin/env python3
"""
Test for the file_search_server example.

This example starts an HTTP server on port 3000 that provides:
- GET /health - Health check endpoint
- GET /search?q=<query> - Search endpoint with AI-summarized results

The test starts the server, verifies the endpoints work, then shuts it down.
"""

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PORT = 3000
BASE_URL = f"http://localhost:{PORT}"
STARTUP_TIMEOUT = 30  # seconds to wait for server to start
REQUEST_TIMEOUT = 60  # seconds for each request


def wait_for_server(url: str, timeout: int = STARTUP_TIMEOUT) -> bool:
    """Wait for the server to be ready."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
            pass
        time.sleep(1)
    return False


def make_request(url: str, timeout: int = REQUEST_TIMEOUT) -> dict:
    """Make a GET request and return JSON response."""
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode())


def main():
    """Run the file_search_server example and verify it works."""
    # Get the package directory and workspace
    package_dir = Path(__file__).parent
    workspace_dir = str(package_dir)
    # Run from the parent directory so module execution works
    context_dir = package_dir.parent

    print(f"Starting server with: python -m file_search_server {workspace_dir}")
    print(f"Working directory: {context_dir}")

    # Start the server as a subprocess using module execution
    server_process = subprocess.Popen(
        [sys.executable, "-m", "file_search_server", workspace_dir],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(context_dir),
    )

    try:
        # Wait for server to be ready
        print(f"Waiting for server at {BASE_URL}/health...")
        if not wait_for_server(f"{BASE_URL}/health"):
            stdout, stderr = server_process.communicate(timeout=5)
            print(f"❌ Server failed to start within {STARTUP_TIMEOUT}s")
            print(f"stdout: {stdout}")
            print(f"stderr: {stderr}")
            sys.exit(1)

        print("✓ Server is ready")

        # Test health endpoint
        print("\nTesting /health endpoint...")
        health = make_request(f"{BASE_URL}/health")
        assert health.get("status") == "ok", f"Expected status 'ok', got: {health}"
        assert health.get("contextReady") is True, f"Context not ready: {health}"
        print(f"✓ Health check passed: {health}")

        # Test search endpoint
        print("\nTesting /search endpoint...")
        search_result = make_request(f"{BASE_URL}/search?q=python")
        # The search should return some result (structure may vary)
        assert isinstance(search_result, dict), f"Expected dict, got: {type(search_result)}"
        print(f"✓ Search returned result with keys: {list(search_result.keys())}")

        print("\n✅ file_search_server example passed")

    finally:
        # Shutdown the server
        print("\nShutting down server...")
        server_process.terminate()
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()
            server_process.wait()
        print("Server stopped")


if __name__ == "__main__":
    main()

