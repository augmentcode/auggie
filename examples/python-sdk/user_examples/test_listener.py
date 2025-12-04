"""Test if listener is being called"""

from auggie_sdk import Agent, AgentListener
from typing import Any, Optional


class TestListener(AgentListener):
    def __init__(self):
        self.called = []

    def on_agent_message(self, message: str):
        print(f"✅ on_agent_message called: {message[:50]}")
        self.called.append("on_agent_message")

    def on_agent_thought(self, text: str):
        print(f"✅ on_agent_thought called: {text[:50]}")
        self.called.append("on_agent_thought")

    def on_tool_call(
        self,
        tool_call_id: str,
        title: str,
        kind: Optional[str] = None,
        status: Optional[str] = None,
    ):
        print(f"✅ on_tool_call called: {title}")
        self.called.append("on_tool_call")

    def on_tool_response(
        self, tool_call_id: str, status: Optional[str] = None, content: Any = None
    ):
        print(f"✅ on_tool_response called: status={status}")
        self.called.append("on_tool_response")


listener = TestListener()
agent = Auggie(listener=listener)
result = agent.run("What is 2 + 2?")
print(f"\nResult: {result}")
print(f"Listener methods called: {listener.called}")
