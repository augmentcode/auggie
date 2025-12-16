"""
Sample: FileSystem Context - Local directory retrieval via MCP

This sample demonstrates:
- Creating a FileSystem Context instance
- Searching a local directory using MCP protocol
- Getting formatted search results
- Interactive Q&A about the workspace using AI
- Code review suggestions using AI
- Properly closing the MCP connection
"""

import sys
from pathlib import Path

from auggie_sdk.context import FileSystemContext


def main():
    print("=== FileSystem Context Sample ===\n")

    # Use the current SDK directory as the workspace
    workspace_dir = str(Path.cwd())
    print(f"Workspace directory: {workspace_dir}")

    # Create a FileSystem Context instance
    # Authentication is handled automatically by the auggie CLI via:
    # 1. AUGMENT_API_TOKEN / AUGMENT_API_URL env vars, or
    # 2. ~/.augment/session.json (created by `auggie login`)
    print("\nCreating FileSystem Context (spawning auggie --mcp)...")
    context = FileSystemContext.create(
        workspace_dir,
        auggie_path="auggie",  # or specify full path to auggie binary
        debug=True,
    )

    try:
        # Search 1: Find Python SDK implementation
        print("\n--- Search 1: Python SDK implementation ---")
        results1 = context.search("Python SDK implementation")
        print("Search results:")
        print(results1[:500])  # Show first 500 chars
        if len(results1) > 500:
            print(f"... ({len(results1) - 500} more characters)")

        # Search 2: Find context modes
        print("\n--- Search 2: Context modes implementation ---")
        results2 = context.search("context modes implementation")
        print("Search results:")
        print(results2[:500])  # Show first 500 chars
        if len(results2) > 500:
            print(f"... ({len(results2) - 500} more characters)")

        # search_and_ask Example 1: Ask questions about the workspace
        print("\n--- search_and_ask Example 1: Ask about context modes ---")
        question1 = "What context modes are available in this SDK?"
        print(f"Question: {question1}")
        answer1 = context.search_and_ask("context modes", question1)
        print(f"\nAnswer: {answer1}")

        # search_and_ask Example 2: Ask about implementation
        print("\n--- search_and_ask Example 2: Ask about generation API ---")
        question2 = "How is the generation API implemented?"
        print(f"Question: {question2}")
        answer2 = context.search_and_ask("generation API implementation", question2)
        print(f"\nAnswer: {answer2}")

        # search_and_ask Example 3: Code review
        print("\n--- search_and_ask Example 3: Code review ---")
        review_file = "auggie_sdk/context/__init__.py"
        print(f"Reviewing: {review_file}")
        review = context.search_and_ask(
            f"file:{review_file}",
            "Review this code for potential issues, bugs, and improvements. Provide specific, actionable feedback.",
        )
        print(f"\nReview:\n{review}")

        # search_and_ask Example 4: Explain patterns
        print("\n--- search_and_ask Example 4: Explain code patterns ---")
        pattern = "error handling"
        print(f"Pattern: {pattern}")
        pattern_explanation = context.search_and_ask(
            pattern,
            f'Explain this code pattern: "{pattern}". What does it do, why is it used, and what are the best practices?',
        )
        print(f"\nExplanation:\n{pattern_explanation}")
    finally:
        # Always close the MCP connection
        print("\nClosing MCP connection...")
        context.close()
        print("MCP connection closed")

    print("\n=== Sample Complete ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Error: {error}")
        sys.exit(1)

