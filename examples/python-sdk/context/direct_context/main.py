"""
Sample: Direct Context - API-based indexing with import/export state

This sample demonstrates:
- Creating a Direct Context instance
- Adding files to the index
- Searching the indexed files
- Using Generation API to ask questions about indexed code
- Generating documentation from indexed code
- Exporting state to a file
- Importing state from a file
"""

import json
import sys
import tempfile
from pathlib import Path

from auggie_sdk.context import DirectContext, File

# Sample files are in the samples/ subdirectory
SAMPLES_DIR = Path(__file__).parent / "samples"


def load_sample_files() -> list[File]:
    """Load sample Python files from the samples directory."""
    files = []
    for file_path in SAMPLES_DIR.rglob("*.py"):
        relative_path = file_path.relative_to(SAMPLES_DIR)
        contents = file_path.read_text()
        files.append(File(path=str(relative_path), contents=contents))
    return files


def main():
    print("=== Direct Context Sample ===\n")

    # Create a Direct Context instance
    # Authentication is automatic via:
    # 1. AUGMENT_API_TOKEN / AUGMENT_API_URL env vars, or
    # 2. ~/.augment/session.json (created by `auggie login`)
    print("Creating Direct Context...")
    context = DirectContext.create(debug=True)

    # Load sample files from the samples/ directory
    print("\nAdding files to index...")
    file_objects = load_sample_files()
    print(f"  Found {len(file_objects)} sample files")
    result = context.add_to_index(file_objects)
    print("\nIndexing result:")
    print(f"  Newly uploaded: {result.newly_uploaded}")
    print(f"  Already uploaded: {result.already_uploaded}")

    # Search the codebase - returns formatted string ready for LLM use or display
    # Using queries that work well with our realistic content
    print("\n--- Search 1: Find string utility functions ---")
    results1 = context.search("string utility functions for text formatting")
    print("Search results:")
    print(results1)

    print("\n--- Search 2: Find user management service ---")
    results2 = context.search("user management service with CRUD operations")
    print("Search results:")
    print(results2)

    print("\n--- Search 3: Find HTTP client for API requests ---")
    http_results = context.search("HTTP client for making API requests")
    print("Search results:")
    print(http_results)

    # Use search_and_ask to ask questions about the indexed code
    print("\n--- search_and_ask Example 1: Ask questions about the code ---")
    question = "How does the UserService class handle user creation and validation?"
    print(f"Question: {question}")

    answer = context.search_and_ask(
        "user creation and validation in UserService",
        question,
    )

    print(f"\nAnswer: {answer}")

    # Use search_and_ask to generate documentation
    print("\n--- search_and_ask Example 2: Generate documentation ---")
    documentation = context.search_and_ask(
        "string utility functions",
        "Generate API documentation in markdown format for the string utility functions",
    )

    print("\nGenerated Documentation:")
    print(documentation)

    # Use search_and_ask to explain code patterns
    print("\n--- search_and_ask Example 3: Explain code patterns ---")
    explanation = context.search_and_ask(
        "utility functions",
        "Explain what these utility functions do and when they would be useful",
    )

    print(f"\nExplanation: {explanation}")

    # Export state to a file
    state_file = Path(tempfile.gettempdir()) / "direct-context-state.json"
    print(f"\nExporting state to {state_file}...")
    context.export_to_file(state_file)
    print("State exported successfully")

    # Show the exported state
    with open(state_file, "r") as f:
        exported_state = json.load(f)
    print("\nExported state:")
    print(json.dumps(exported_state, indent=2))

    # Import state in a new context
    print("\n--- Testing state import ---")
    context2 = DirectContext.import_from_file(state_file, debug=False)
    print("State imported successfully")

    # Verify we can still search
    results3 = context2.search("string utility functions")
    print("\nSearch after importing state:")
    print(results3)

    print("\n=== Sample Complete ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Error: {error}")
        sys.exit(1)

