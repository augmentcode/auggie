#!/usr/bin/env python3
"""
Example demonstrating session context manager usage.
"""

import sys
from pathlib import Path
from dataclasses import dataclass

# Add the parent directory to the path so we can import auggie_sdk
sys.path.insert(0, str(Path(__file__).parent.parent))

from auggie_sdk import Auggie


@dataclass
class Function:
    name: str
    description: str
    parameters: list
    return_type: str


def main():
    """Demonstrate session vs non-session usage."""
    
    agent = Auggie()
    
    print("🔄 DEFAULT BEHAVIOR - Each call is independent:")
    print("=" * 50)
    
    # Default behavior - no memory between calls
    response1 = agent.run("Create a function called 'calculate_area' that takes width and height")
    print("✅ Created function")
    
    # This call won't remember the previous function
    response2 = agent.run("Now create a test for that function")
    print("✅ Attempted to create test (but agent may not remember the function)")
    
    print("\n🔗 SESSION BEHAVIOR - Calls remember each other:")
    print("=" * 50)
    
    # Session behavior - memory between calls (CLI creates session ID)
    with agent.session() as session:
        # First call in session
        session.run("Create a function called 'calculate_volume' that takes length, width, and height")
        print("✅ Created volume function in session")

        # Second call remembers the first
        session.run("Now create a comprehensive test suite for that function")
        print("✅ Created tests (agent remembers the volume function)")

        # Third call with typed result - also remembers previous context
        functions = session(list[Function]) @ "List all the functions we've created in this conversation"
        print(f"✅ Retrieved {len(functions)} functions from session memory:")
        for func in functions:
            print(f"   - {func.name}: {func.description}")

        print(f"   Session ID from CLI: {session.last_session_id}")

    print(f"   Agent now remembers last session: {agent.last_session_id}")
    
    print("\n🎯 MIXED USAGE - Sessions for related work, independent calls for unrelated:")
    print("=" * 50)
    
    # Independent call
    agent.run("What's the weather like?")
    print("✅ Independent weather query")
    
    # Continue the previous session automatically (uses agent.last_session_id)
    print(f"\n   Continuing last session automatically...")
    with agent.session() as session:  # Automatically resumes last session
        session.run("Add error handling to the volume function")
        print("✅ Continued session and added error handling")

    # New session for different task (CLI creates new session ID)
    with agent.session() as session:
        session.run("Create a function to reverse a string")
        session.run("Create a function to check if a string is a palindrome")

        # This will only know about string functions, not the math functions from before
        string_functions = session(list[Function]) @ "List the string utility functions we created"
        print(f"✅ String session has {len(string_functions)} functions:")
        for func in string_functions:
            print(f"   - {func.name}: {func.description}")

        print(f"   New session ID: {session.last_session_id}")

    print("\n✨ Session context manager provides clean separation of concerns!")
    print("    - CLI automatically creates session IDs")
    print("    - agent.session() automatically resumes last session if available")
    print("    - agent.session(id) explicitly specifies a session ID")
    print("    - Agent remembers last_session_id for automatic continuation")


if __name__ == "__main__":
    main()
