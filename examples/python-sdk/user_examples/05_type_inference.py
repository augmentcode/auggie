"""Automatic Type Inference Example from user_guide.md"""

from auggie_sdk import Auggie

agent = Auggie()

# Automatic type inference
result = agent.run("What is 2 + 2?")
print(f"Result: {result} (Type: {type(result).__name__})")
# Output: Result: 4 (Type: int)

# It handles complex types too
result = agent.run("Return a list of the first 3 prime numbers")
print(result)
# Output: [2, 3, 5]
