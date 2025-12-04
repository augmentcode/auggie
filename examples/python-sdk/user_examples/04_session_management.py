"""Session Management Example from user_guide.md"""

from auggie_sdk import Auggie

agent = Auggie()

# ❌ INCORRECT: These calls don't know about each other
agent.run("Remember that my favorite color is blue")
result1 = agent.run("What is my favorite color?")  # Agent won't know
print(f"Without session: {result1}")

# ✅ CORRECT: Using a session for shared context
with agent.session() as session:
    session.run("Remember that my favorite color is blue")
    response = session.run("What is my favorite color?")
    print(f"With session: {response}")  # Output: Blue
