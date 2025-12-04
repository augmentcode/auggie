"""Quick Start Example from user_guide.md"""

from auggie_sdk import Auggie

# Create an agent instance
agent = Auggie()

# Run a simple instruction
response = agent.run("What is the capital of France?")
print(response)
# Output: Paris
