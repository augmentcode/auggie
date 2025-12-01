#!/usr/bin/env python3
"""
Example: Using a mock ACP client for testing

This example demonstrates how to create an Agent with a provided ACPClient
for testing purposes. This is useful when you want to test your code that
uses the Agent without making real calls to the auggie CLI.
"""

from auggie_sdk import Auggie
from auggie_sdk.acp import ACPClient


class MockACPClient(ACPClient):
    """
    A simple mock ACP client for testing.
    
    This client simulates responses without actually calling the auggie CLI.
    """
    
    def __init__(self):
        self._running = False
        self._responses = {
            "What is 2 + 2?": "4",
            "What is the capital of France?": "Paris",
            "List three colors": "Red, Blue, Green",
        }
    
    def start(self) -> None:
        """Start the mock client."""
        if self._running:
            raise RuntimeError("Client is already running")
        self._running = True
        print("Mock client started")
    
    def stop(self) -> None:
        """Stop the mock client."""
        self._running = False
        print("Mock client stopped")
    
    def send_message(self, message: str, timeout: float = 30.0) -> str:
        """
        Send a message and get a mock response.
        
        Args:
            message: The message to send
            timeout: Ignored in mock
            
        Returns:
            A mock response based on the message
        """
        if not self._running:
            raise RuntimeError("Client is not running")
        
        print(f"Mock client received: {message}")
        
        # Return a predefined response if available
        for question, answer in self._responses.items():
            if question.lower() in message.lower():
                return answer
        
        # Default response
        return "I don't have a mock response for that question."
    
    def clear_context(self) -> None:
        """Clear context (no-op in mock)."""
        print("Mock client context cleared")
    
    @property
    def is_running(self) -> bool:
        """Check if the mock client is running."""
        return self._running


def main():
    """Demonstrate using a mock ACP client."""
    print("=" * 80)
    print("Example: Using a Mock ACP Client for Testing")
    print("=" * 80)
    print()
    
    # Create a mock client
    mock_client = MockACPClient()
    
    # Create an agent with the mock client
    agent = Auggie(acp_client=mock_client)
    
    print("1. Testing with run() - client is started/stopped automatically")
    print("-" * 80)
    response1 = agent.run("What is 2 + 2?")
    print(f"Response: {response1}")
    print()
    
    print("2. Testing with another run() call")
    print("-" * 80)
    response2 = agent.run("What is the capital of France?")
    print(f"Response: {response2}")
    print()
    
    print("3. Testing with session - client stays running")
    print("-" * 80)
    with agent.session() as session:
        response3 = session.run("List three colors")
        print(f"Response: {response3}")
        
        response4 = session.run("What is 2 + 2?")
        print(f"Response: {response4}")
    print()
    
    print("=" * 80)
    print("Benefits of using a provided ACP client:")
    print("  - Test your code without calling the real auggie CLI")
    print("  - Control responses for predictable testing")
    print("  - Faster test execution")
    print("  - No need for authentication or network access")
    print("=" * 80)


if __name__ == "__main__":
    main()

