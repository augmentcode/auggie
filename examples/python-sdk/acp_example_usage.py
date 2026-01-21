"""
Example usage of the AuggieACPClient.

This demonstrates all the key features:
1. Starting/stopping the agent
2. Sending messages and getting responses
3. Listening to events via a custom listener
4. Clearing context
"""

from auggie_sdk.acp import AuggieACPClient, AgentEventListener
from typing import Optional, Any


class MyEventListener(AgentEventListener):
    """Example event listener that prints all agent events."""

    def on_agent_message_chunk(self, text: str) -> None:
        """Called when the agent sends a message chunk."""
        print(f"[AGENT MESSAGE] {text}", end="", flush=True)

    def on_tool_call(
        self,
        tool_call_id: str,
        title: str,
        kind: Optional[str] = None,
        status: Optional[str] = None,
    ) -> None:
        """Called when the agent starts a tool call."""
        print(f"\n[TOOL CALL START] {title}")
        print(f"  ID: {tool_call_id}")
        print(f"  Kind: {kind}")
        print(f"  Status: {status}")

    def on_tool_response(
        self,
        tool_call_id: str,
        status: Optional[str] = None,
        content: Optional[Any] = None,
    ) -> None:
        """Called when a tool response is received."""
        print(f"[TOOL RESPONSE] {tool_call_id}")
        print(f"  Status: {status}")
        if content:
            print(f"  Content: {str(content)[:100]}...")  # Truncate long content

    def on_agent_thought(self, text: str) -> None:
        """Called when the agent shares its internal reasoning."""
        print(f"[AGENT THOUGHT] {text}", end="", flush=True)


def example_basic_usage():
    """Example 1: Basic usage without event listener."""
    print("=" * 80)
    print("EXAMPLE 1: Basic Usage")
    print("=" * 80)

    # Create client without listener
    # You can optionally specify model and workspace_root:
    # client = AuggieACPClient(
    #     model="sonnet4.5",  # Model string
    #     workspace_root="/path/to/workspace"
    # )
    client = AuggieACPClient()

    # Start the agent
    print("Starting agent...")
    client.start()
    print(f"Agent started! Session ID: {client.session_id}\n")

    # Send a simple message
    message = "What is 2 + 2? Answer in one sentence."
    print(f"Sending: {message}")
    response = client.send_message(message)
    print(f"Response: {response}\n")

    # Stop the agent
    print("Stopping agent...")
    client.stop()
    print("Agent stopped.\n")


def example_with_listener():
    """Example 2: Using an event listener to see what the agent is doing."""
    print("=" * 80)
    print("EXAMPLE 2: With Event Listener")
    print("=" * 80)

    # Create client with listener
    listener = MyEventListener()
    client = AuggieACPClient(listener=listener)

    print("Starting agent...")
    client.start()
    print(f"Agent started! Session ID: {client.session_id}\n")

    # Send a message that will trigger tool calls
    message = "Please read the README.md file in the current directory and summarize it in one sentence."
    print(f"Sending: {message}\n")
    response = client.send_message(message, timeout=30.0)
    print(f"\n\nFinal Response: {response}\n")

    client.stop()
    print("Agent stopped.\n")


def example_context_manager():
    """Example 3: Using context manager for automatic cleanup."""
    print("=" * 80)
    print("EXAMPLE 3: Context Manager")
    print("=" * 80)

    listener = MyEventListener()

    # Use context manager - automatically starts and stops
    with AuggieACPClient(listener=listener) as client:
        print(f"Agent started! Session ID: {client.session_id}\n")

        message = "What is 10 * 5?"
        print(f"Sending: {message}\n")
        response = client.send_message(message)
        print(f"\n\nFinal Response: {response}\n")

    print("Agent automatically stopped.\n")


def example_clear_context():
    """Example 4: Clearing context between conversations."""
    print("=" * 80)
    print("EXAMPLE 4: Clearing Context")
    print("=" * 80)

    client = AuggieACPClient()
    client.start()

    # First conversation
    print("First conversation:")
    print(f"Session ID: {client.session_id}")
    response1 = client.send_message("Remember this number: 42")
    print(f"Response: {response1}\n")

    # Clear context (restarts agent with new session)
    print("Clearing context...")
    old_session_id = client.session_id
    client.clear_context()
    print(
        f"Context cleared! Old session: {old_session_id}, New session: {client.session_id}\n"
    )

    # Second conversation - agent won't remember the number
    print("Second conversation (after clearing context):")
    response2 = client.send_message("What number did I ask you to remember?")
    print(f"Response: {response2}\n")

    client.stop()
    print("Agent stopped.\n")


def example_multiple_messages():
    """Example 5: Multiple messages in the same session."""
    print("=" * 80)
    print("EXAMPLE 5: Multiple Messages in Same Session")
    print("=" * 80)

    client = AuggieACPClient()
    client.start()
    print(f"Session ID: {client.session_id}\n")

    # Send multiple messages in the same session
    messages = [
        "What is 5 + 3?",
        "What is that number multiplied by 2?",
        "What is the final result?",
    ]

    for i, message in enumerate(messages, 1):
        print(f"Message {i}: {message}")
        response = client.send_message(message)
        print(f"Response {i}: {response}\n")

    client.stop()
    print("Agent stopped.\n")


def example_model_and_workspace():
    """Example 6: Using model and workspace configuration."""
    print("=" * 80)
    print("EXAMPLE 6: Model and Workspace Configuration")
    print("=" * 80)

    import os

    # Create client with specific model and workspace
    # Use model string directly:
    client = AuggieACPClient(
        model="sonnet4.5",  # Model string
        workspace_root=os.getcwd(),  # Specify workspace root
    )

    # Or use a string directly:
    # client = AuggieACPClient(
    #     model="sonnet4.5",  # String also works
    #     workspace_root=os.getcwd(),
    # )

    print(f"Starting agent with model: {client.model}")
    print(f"Workspace root: {client.workspace_root}\n")

    client.start()
    print(f"Agent started! Session ID: {client.session_id}\n")

    # Send a message
    message = "What is 5 * 7? Answer with just the number."
    print(f"Sending: {message}")
    response = client.send_message(message)
    print(f"Response: {response}\n")

    # Stop the agent
    client.stop()
    print("Agent stopped.\n")


def main():
    """Run all examples."""
    print("\n" + "=" * 80)
    print("AUGGIE ACP CLIENT - EXAMPLES")
    print("=" * 80 + "\n")

    # Run examples
    example_basic_usage()
    input("Press Enter to continue to next example...")

    example_with_listener()
    input("Press Enter to continue to next example...")

    example_context_manager()
    input("Press Enter to continue to next example...")

    example_clear_context()
    input("Press Enter to continue to next example...")

    example_multiple_messages()
    input("Press Enter to continue to next example...")

    example_model_and_workspace()

    print("\n" + "=" * 80)
    print("ALL EXAMPLES COMPLETED")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    # Run just one example for quick testing
    # Uncomment the one you want to run:

    # example_basic_usage()
    # example_with_listener()
    # example_context_manager()
    # example_clear_context()
    # example_multiple_messages()
    example_model_and_workspace()

    # Or run all examples:
    # main()
