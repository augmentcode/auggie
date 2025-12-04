"""Success Criteria & Verification Example from user_guide.md"""

from auggie_sdk import Auggie

agent = Auggie()

# The agent will verify its work meets the criteria
result = agent.run(
    "Write a Python function to calculate fibonacci numbers",
    success_criteria=[
        "Function has type hints",
        "Function has a docstring",
        "Function handles the base cases (0 and 1)",
    ],
    max_verification_rounds=3,  # Optional: limit retry attempts (default: 3)
)
print(result)
