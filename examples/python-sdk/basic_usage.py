#!/usr/bin/env python3
"""
Basic usage examples for the Augment Python SDK.
"""

import sys
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

# Add the parent directory to the path so we can import auggie_sdk
sys.path.insert(0, str(Path(__file__).parent.parent))

from auggie_sdk import Auggie


@dataclass
class Task:
    title: str
    priority: str
    estimated_hours: int


class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


def main():
    """Demonstrate basic agent usage."""

    # Create an agent with custom model
    # Supported models: "haiku4.5", "sonnet4.5", "sonnet4", "gpt5"
    agent = Auggie(model="sonnet4.5")

    print("🤖 Basic Agent Usage Examples")
    print("=" * 40)

    # Example 1: Automatic type inference (no return_type specified)
    print("\n1. Automatic type inference:")
    result, inferred_type = agent.run("What is 15 + 27?")
    print(f"Result: {result} (inferred type: {inferred_type.__name__})")

    # Example 2: Explicit typed response - integer
    print("\n2. Explicit typed response (integer):")
    result = agent.run("What is 15 + 27?", int)
    print(f"Result: {result} (type: {type(result).__name__})")

    # Example 3: @ operator syntax
    print("\n3. @ operator syntax:")
    result = agent(int) @ "What is 8 * 7?"
    print(f"Result: {result} (type: {type(result).__name__})")

    # Example 4: List of strings
    print("\n4. List of strings:")
    colors = agent(list[str]) @ "Give me 5 colors"
    print(f"Colors: {colors}")

    # Example 5: Dataclass result
    print("\n5. Dataclass result:")
    task = agent(Task) @ "Create a task: 'Write unit tests', medium priority, 4 hours"
    print(
        f"Task: {task.title}, Priority: {task.priority}, Hours: {task.estimated_hours}"
    )

    # Example 6: List of dataclasses
    print("\n6. List of dataclasses:")
    tasks = agent(list[Task]) @ "Create 3 example programming tasks"
    print("Tasks:")
    for i, task in enumerate(tasks, 1):
        print(
            f"  {i}. {task.title} ({task.priority} priority, {task.estimated_hours}h)"
        )

    # Example 7: Enum result
    print("\n7. Enum result:")
    priority = (
        agent(Priority) @ "What priority should 'fix critical security bug' have?"
    )
    print(f"Priority: {priority} (type: {type(priority).__name__})")

    # Example 8: Access model's explanation
    print("\n8. Model explanation:")
    result = agent(bool) @ "Is Python a compiled language?"
    print(f"Answer: {result}")
    print(f"Explanation: {agent.last_model_answer}")

    # Example 9: Session context manager
    print("\n9. Session context manager:")
    print("   Default behavior (no memory):")
    agent.run("Create a function called 'greet_user'")
    agent.run("Now add error handling to that function")  # Won't remember greet_user
    print("   ✅ Independent calls completed")

    print("   Session behavior (with memory - CLI creates session ID):")
    with agent.session() as session:
        session.run(
            "Create a function called 'calculate_discount' that takes price and percentage"
        )
        session.run(
            "Now add input validation to that function"
        )  # Remembers calculate_discount
        session.run(
            "Add comprehensive docstring and type hints"
        )  # Remembers the function

        # Use @ operator in session
        functions = (
            session(list[str])
            @ "List all the functions we've worked on in this session"
        )
        print(f"   Functions in session: {functions}")
        print(f"   Session ID: {session.last_session_id}")

    print("   Continuing the same session automatically:")
    with agent.session() as session:  # Automatically resumes last session
        session.run("Add unit tests for the discount function")
        print("   ✅ Continued session and added tests")

    print("\n✅ All examples completed successfully!")


if __name__ == "__main__":
    main()
