"""Custom Listener Example from user_guide.md"""

from auggie_sdk import Auggie, AgentListener
from typing import Any, Optional


class MyCustomListener(AgentListener):
    def on_agent_thought(self, text: str):
        """Called when the agent shares its internal reasoning."""
        print(f"[Thinking] {text[:100]}...")

    def on_tool_call(
        self,
        tool_call_id: str,
        title: str,
        kind: Optional[str] = None,
        status: Optional[str] = None,
    ):
        """Called when the agent is about to execute a tool."""
        print(f"[Tool Call] {title} (kind={kind}, status={status})")

    def on_tool_response(
        self, tool_call_id: str, status: Optional[str] = None, content: Any = None
    ):
        """Called when a tool execution completes."""
        print(f"[Tool Result] status={status}, content={str(content)[:50]}...")

    def on_agent_message(self, message: str):
        """Called when the agent sends a complete message."""
        print(f"[Agent Message] {message}")


agent = Auggie(listener=MyCustomListener())
agent.run("What is 5 * 5?")
