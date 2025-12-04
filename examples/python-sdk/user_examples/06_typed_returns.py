"""Explicit Type Specification Example from user_guide.md"""

from auggie_sdk import Auggie
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class Task:
    id: int
    description: str
    is_done: bool


agent = Auggie()

# Get a strongly-typed object back
task = agent.run("Create a sample task for 'Buy groceries'", return_type=Task)
print(f"Task {task.id}: {task.description} (Done: {task.is_done})")

# Get a list of objects
tasks = agent.run(
    "Create 3 sample tasks for a weekend to-do list", return_type=List[Task]
)
for t in tasks:
    print(f"- {t.description}")

# Get a dictionary of simple types
counts = agent.run(
    "Count the number of vowels in 'hello world' and return as a dict",
    return_type=Dict[str, int],
)
print(counts)
# Output: {'e': 1, 'o': 2}
