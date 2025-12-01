#!/usr/bin/env python3
"""
Demo: Session Continuity in ACP Client

This demonstrates how the ACP client automatically maintains session context
across multiple messages, unlike the Agent library which requires explicit
session management.
"""

from auggie_sdk.acp import AuggieACPClient, AgentEventListener


class SimpleListener(AgentEventListener):
    """Simple listener that prints agent responses."""

    def on_agent_message_chunk(self, text: str):
        print(text, end="", flush=True)


def demo_session_continuity():
    """Demonstrate automatic session continuity."""
    print("=" * 80)
    print("DEMO: Automatic Session Continuity in ACP Client")
    print("=" * 80)
    print()

    # Create client with listener for real-time output
    client = AuggieACPClient(
        model="claude-3-5-sonnet-latest", listener=SimpleListener()
    )

    print("Starting ACP client (creates a persistent session)...")
    client.start()
    print(f"✓ Session started: {client.session_id}\n")

    # Message 1: Ask agent to remember something
    print("=" * 80)
    print("MESSAGE 1: Remember a number")
    print("=" * 80)
    print()
    client.send_message("Remember the number 42. Just acknowledge you'll remember it.")
    print("\n")

    input("Press Enter to send next message...")
    print()

    # Message 2: Ask agent to recall it
    print("=" * 80)
    print("MESSAGE 2: Recall the number (tests session continuity)")
    print("=" * 80)
    print()
    client.send_message("What number did I ask you to remember?")
    print("\n")

    input("Press Enter to send next message...")
    print()

    # Message 3: Do some math with it
    print("=" * 80)
    print("MESSAGE 3: Use the number in a calculation")
    print("=" * 80)
    print()
    client.send_message("What is that number multiplied by 2?")
    print("\n")

    input("Press Enter to send next message...")
    print()

    # Message 4: Create a function
    print("=" * 80)
    print("MESSAGE 4: Create a function")
    print("=" * 80)
    print()
    client.send_message(
        "Create a Python function called 'greet' that takes a name and returns 'Hello, {name}!'"
    )
    print("\n")

    input("Press Enter to send next message...")
    print()

    # Message 5: Reference the function we just created
    print("=" * 80)
    print("MESSAGE 5: Reference the function (tests code context)")
    print("=" * 80)
    print()
    client.send_message("Now call that greet function with the name 'Alice'")
    print("\n")

    # Stop the client
    print("=" * 80)
    print("Stopping client...")
    client.stop()
    print("✓ Client stopped")
    print("=" * 80)
    print()

    print("✅ DEMO COMPLETE!")
    print()
    print("Key Takeaway:")
    print("  - All 5 messages went to the SAME session")
    print("  - The agent remembered the number (42)")
    print("  - The agent remembered the function (greet)")
    print("  - NO explicit session management needed!")
    print("  - This is the power of the long-running ACP architecture")
    print()


def demo_comparison():
    """Show the difference between Agent and ACP client."""
    print("=" * 80)
    print("COMPARISON: Agent vs ACP Client Session Management")
    print("=" * 80)
    print()

    print("Agent Library (subprocess-based):")
    print("-" * 80)
    print("""
# Each call spawns a new process - NO context by default
agent = Auggie()
agent.run("Remember the number 42")
agent.run("What number did I ask you to remember?")  # ❌ Doesn't remember!

# Need explicit session for context
with agent.session() as session:
    session.run("Remember the number 42")
    session.run("What number did I ask you to remember?")  # ✅ Remembers!
""")

    print()
    print("ACP Client (long-running):")
    print("-" * 80)
    print("""
# Single process, single session - context is AUTOMATIC
client = AuggieACPClient()
client.start()
client.send_message("Remember the number 42")
client.send_message("What number did I ask you to remember?")  # ✅ Remembers!
client.stop()
""")

    print()
    print("Summary:")
    print("  - Agent: Explicit session management required for context")
    print("  - ACP Client: Automatic session continuity, no management needed")
    print()


if __name__ == "__main__":
    print("\n")

    # Show comparison first
    demo_comparison()

    input("Press Enter to run the live demo...")
    print("\n")

    # Run the live demo
    demo_session_continuity()
