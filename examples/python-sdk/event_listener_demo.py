#!/usr/bin/env python3
"""
Example: AgentEventListener Demo

This example demonstrates all the events in the AgentEventListener interface
and shows you exactly when each event is triggered and what data it contains.
"""

import time
from typing import Any, Optional

from auggie_sdk import Auggie
from auggie_sdk.acp import AgentEventListener


class DetailedEventLogger(AgentEventListener):
    """
    A listener that logs all events with detailed information.
    
    This helps you understand what's happening during agent execution.
    """
    
    def __init__(self):
        self.message_chunks = []
        self.tool_calls = {}
        self.thoughts = []
        self.start_time = time.time()
    
    def _timestamp(self) -> str:
        """Get elapsed time since start."""
        elapsed = time.time() - self.start_time
        return f"[{elapsed:6.2f}s]"
    
    def on_agent_message_chunk(self, text: str) -> None:
        """
        Called when the agent sends a message chunk (streaming).

        This is the agent's final response to you, streamed in real-time.
        You'll receive many small chunks that together form the complete message.
        """
        self.message_chunks.append(text)

        # Show the chunk (with visible quotes to see whitespace)
        print(f"{self._timestamp()} 💬 AGENT MESSAGE CHUNK: {repr(text)}")

    def on_agent_message(self, message: str) -> None:
        """
        Called when the agent finishes sending the complete message.

        This is called once with the full assembled message.
        """
        print(f"{self._timestamp()} ✅ COMPLETE MESSAGE: {repr(message)}")
    
    def on_tool_call(
        self,
        tool_call_id: str,
        title: str,
        kind: Optional[str] = None,
        status: Optional[str] = None,
    ) -> None:
        """
        Called when the agent makes a tool call.

        Tools are things like:
        - "view" - reading a file
        - "str-replace-editor" - editing a file
        - "launch-process" - running a command
        - "save-file" - creating a new file
        """
        self.tool_calls[tool_call_id] = {
            "title": title,
            "kind": kind,
            "status": status,
            "start_time": time.time(),
            "responses": []
        }

        print(f"\n{self._timestamp()} 🔧 TOOL CALL:")
        print(f"    ID:     {tool_call_id}")
        print(f"    Title:  {title}")
        print(f"    Kind:   {kind}")
        print(f"    Status: {status}")

    def on_tool_response(
        self,
        tool_call_id: str,
        status: Optional[str] = None,
        content: Optional[Any] = None,
    ) -> None:
        """
        Called when a tool responds with results.

        This happens when:
        - The tool completes and returns results
        - The tool fails with an error
        """
        if tool_call_id in self.tool_calls:
            self.tool_calls[tool_call_id]["responses"].append({
                "status": status,
                "content": content,
                "time": time.time()
            })

        print(f"{self._timestamp()} 📥 TOOL RESPONSE:")
        print(f"    ID:     {tool_call_id}")
        print(f"    Status: {status}")
        if content:
            # Show first 100 chars of content
            content_str = str(content)[:100]
            print(f"    Content: {content_str}...")
    
    def on_agent_thought(self, text: str) -> None:
        """
        Called when the agent shares its internal reasoning.
        
        This is like the agent "thinking out loud" about what it's going to do.
        Not all agents/models provide thoughts.
        """
        self.thoughts.append(text)
        print(f"{self._timestamp()} 💭 AGENT THOUGHT: {text}")
    
    def print_summary(self):
        """Print a summary of all events."""
        print("\n" + "=" * 80)
        print("EVENT SUMMARY")
        print("=" * 80)
        
        print(f"\n📊 Statistics:")
        print(f"  - Message chunks received: {len(self.message_chunks)}")
        print(f"  - Tool calls made: {len(self.tool_calls)}")
        print(f"  - Thoughts shared: {len(self.thoughts)}")
        
        print(f"\n💬 Complete Agent Message:")
        full_message = "".join(self.message_chunks)
        print(f"  {full_message}")
        
        if self.tool_calls:
            print(f"\n🔧 Tools Used:")
            for tool_id, info in self.tool_calls.items():
                print(f"  - {info['title']} ({info['kind']})")
                print(f"    Responses: {len(info['responses'])}")
        
        if self.thoughts:
            print(f"\n💭 Agent Thoughts:")
            for thought in self.thoughts:
                print(f"  - {thought}")


def demo_simple_query():
    """Demo 1: Simple query that doesn't use tools."""
    print("\n" + "=" * 80)
    print("DEMO 1: Simple Math Query (No Tools)")
    print("=" * 80)
    print("This query is simple enough that the agent can answer directly")
    print("without using any tools. You'll see message chunks but no tool calls.")
    print()
    
    listener = DetailedEventLogger()
    agent = Auggie(listener=listener)
    
    print("Sending: 'What is 2 + 2?'\n")
    response = agent.run("What is 2 + 2?")
    
    listener.print_summary()


def demo_file_operation():
    """Demo 2: Query that requires reading a file."""
    print("\n" + "=" * 80)
    print("DEMO 2: File Reading Query (Uses Tools)")
    print("=" * 80)
    print("This query requires the agent to read a file, so you'll see")
    print("tool calls in addition to the message chunks.")
    print()
    
    listener = DetailedEventLogger()
    agent = Auggie(listener=listener)
    
    print("Sending: 'How many lines are in the file README.md?'\n")
    response = agent.run("How many lines are in the file README.md?")
    
    listener.print_summary()


def demo_with_session():
    """Demo 3: Multiple queries in a session."""
    print("\n" + "=" * 80)
    print("DEMO 3: Session with Multiple Queries")
    print("=" * 80)
    print("Using a session to maintain context across multiple queries.")
    print()
    
    listener = DetailedEventLogger()
    agent = Auggie(listener=listener)
    
    with agent.session() as session:
        print("Query 1: 'What is 5 + 3?'\n")
        response1 = session.run("What is 5 + 3?")
        
        print("\n" + "-" * 80)
        print("Query 2: 'What was the last number I asked about?'\n")
        response2 = session.run("What was the last number I asked about?")
    
    listener.print_summary()


def main():
    """Run all demos."""
    print("""
╔════════════════════════════════════════════════════════════════════════════╗
║                    AgentEventListener Demo                                 ║
║                                                                            ║
║  This demo shows you exactly what events are triggered when you use       ║
║  the Agent, and what data each event contains.                            ║
╚════════════════════════════════════════════════════════════════════════════╝
    """)
    
    # Run demos
    demo_simple_query()
    
    print("\n\n" + "🎯 " * 20)
    input("Press Enter to continue to Demo 2...")
    demo_file_operation()
    
    print("\n\n" + "🎯 " * 20)
    input("Press Enter to continue to Demo 3...")
    demo_with_session()
    
    print("\n\n" + "=" * 80)
    print("✅ All demos complete!")
    print("=" * 80)
    print("\nKey Takeaways:")
    print("  1. on_agent_message_chunk() is called many times with small chunks")
    print("  2. on_agent_message() is called once with the complete message")
    print("  3. on_tool_call() is called when the agent uses a tool")
    print("  4. on_tool_response() provides the tool's results")
    print("  5. on_agent_thought() shows the agent's reasoning (if available)")
    print("\nSee docs/AGENT_EVENT_LISTENER.md for more details!")


if __name__ == "__main__":
    main()

