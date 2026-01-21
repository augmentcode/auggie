"""Built-in Logger Example from user_guide.md"""

from auggie_sdk import Auggie, LoggingAgentListener

# Use the built-in logger for easy debugging
agent = Auggie(listener=LoggingAgentListener(verbose=True))

result = agent.run("What is 2 + 2?")
print(f"\nFinal result: {result}")
# Output will include:
# 🔧 Tool calls
# 💭 Thinking messages
# 💬 Agent messages
