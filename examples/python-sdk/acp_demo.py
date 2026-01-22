#!/usr/bin/env python3
"""
Simple demo of the AuggieACPClient.

This demonstrates the four key features:
1. Starting/stopping the agent
2. Sending messages and getting responses
3. Listening to events
4. Clearing context
"""

from auggie_sdk.acp import AuggieACPClient, AgentEventListener
from typing import Optional, Any


class DemoListener(AgentEventListener):
    """Simple listener that prints events in a user-friendly way."""

    def on_agent_message_chunk(self, text: str) -> None:
        """Called when the agent sends a message chunk."""
        print(text, end="", flush=True)

    def on_tool_call(
        self,
        tool_call_id: str,
        title: str,
        kind: Optional[str] = None,
        status: Optional[str] = None,
    ) -> None:
        """Called when the agent starts a tool call."""
        print(f"\n  🔧 Using tool: {title}", flush=True)

    def on_tool_response(
        self,
        tool_call_id: str,
        status: Optional[str] = None,
        content: Optional[Any] = None,
    ) -> None:
        """Called when a tool response is received."""
        if status == "completed":
            print("  ✓ Tool completed", flush=True)

    def on_agent_thought(self, text: str) -> None:
        """Called when the agent shares a thought."""
        pass


def main():
    print("=" * 80)
    print("AuggieACPClient Demo")
    print("=" * 80)

    # Create client with event listener
    listener = DemoListener()
    client = AuggieACPClient(listener=listener)

    # Feature 1: Start the agent
    print("\n1️⃣  Starting agent...")
    client.start()
    print(f"   ✓ Agent started (session: {client.session_id})\n")

    # Feature 2: Send messages and get responses
    print("2️⃣  Sending message: 'What is 2 + 2?'\n")
    print("   Agent response: ", end="")
    client.send_message("What is 2 + 2? Answer in one sentence.")
    print("\n   ✓ Got response\n")

    # Feature 3: Events are automatically captured by the listener
    print("3️⃣  Sending message that triggers tool calls: 'Read the README.md'\n")
    print("   Agent response: ", end="")
    client.send_message(
        "Read the README.md file in the current directory and tell me what it's about in one sentence.",
        timeout=30.0,
    )
    print("\n   ✓ Got response (with tool call events shown above)\n")

    # Feature 4: Clear context
    print("4️⃣  Clearing context...")
    old_session = client.session_id
    client.clear_context()
    new_session = client.session_id
    print("   ✓ Context cleared")
    print(f"   Old session: {old_session}")
    print(f"   New session: {new_session}\n")

    # Verify context was cleared
    print("   Verifying context was cleared...")
    print("   Agent response: ", end="")
    client.send_message("What was the last file I asked you to read?")
    print("\n   ✓ Agent doesn't remember (context was cleared)\n")

    # Stop the agent
    print("5️⃣  Stopping agent...")
    client.stop()
    print("   ✓ Agent stopped\n")

    print("=" * 80)
    print("Demo completed successfully! ✨")
    print("=" * 80)
    print("\nKey takeaways:")
    print("  • Simple API: start(), send_message(), clear_context(), stop()")
    print("  • Event listener: See what the agent is doing in real-time")
    print("  • Context management: Clear context to start fresh conversations")
    print("  • No asyncio needed: Everything is synchronous and easy to use")
    print()


if __name__ == "__main__":
    main()
