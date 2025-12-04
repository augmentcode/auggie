# Auggie Python SDK

A Python SDK for interacting with the Augment CLI agent (`auggie`) programmatically.

## Prerequisites

1.  **Python**
2.  **Augment CLI (`auggie`)**: Must be installed and authenticated on your system.
    *   **Note:** The SDK currently requires the pre-release version of auggie
    *   Install: `npm install -g @augmentcode/auggie@prerelease`
    *   Login: `auggie auth login`

## Installation

Install the SDK from PyPI:

```bash
pip install auggie-sdk
```

## Quick Start

```python
from auggie_sdk import Auggie

# Create an agent instance
agent = Auggie()

# Run a simple instruction
response = agent.run("What is the capital of France?")
print(response)
# Output: Paris
```

---

## Listening to Events

To monitor the agent's internal actions (tool calls, thoughts, function executions), you can attach a listener.

### Built-in Logger

Use the built-in `LoggingAgentListener` for easy debugging to stdout:

```python
from auggie_sdk import Agent, LoggingAgentListener

# Use the built-in logger for easy debugging
agent = Auggie(listener=LoggingAgentListener(verbose=True))

agent.run("Find the 'main' function in src/app.py and summarize it")
# Output will now include:
# 🔧 Tool: view (read)
# 💭 Thinking: I need to read the file first...
# 💬 Agent: The main function does...
```

### Custom Listener

You can implement your own listener by subclassing `AgentListener`. This is useful for integrating with custom logging systems, UIs, or for programmatic reactions to agent events.

```python
from auggie_sdk import Agent, AgentListener
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
```

---

## Core Features

### 1. Session Management

By default, every `agent.run()` call is independent and has no memory of previous calls. Use a **session** to maintain conversational context.

```python
from auggie_sdk import Auggie

agent = Auggie()

# ❌ INCORRECT: These calls don't know about each other
agent.run("Remember that my favorite color is blue")
agent.run("What is my favorite color?") # Agent won't know

# ✅ CORRECT: Using a session for shared context
with agent.session() as session:
    session.run("Remember that my favorite color is blue")
    response = session.run("What is my favorite color?")
    print(response) # Output: Blue
```

### 2. Typed Returns

The SDK provides flexible type handling for agent responses.

#### Automatic Type Inference

By default, the agent returns a string. You can let it automatically infer the best type (int, float, bool, list, dict, str):

```python
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
```

#### Explicit Type Specification

For strict control, specify the exact `return_type` you expect. The SDK ensures the agent returns data in this format, automatically retrying if it fails initially.

Supported types: `int`, `float`, `str`, `bool`, `list`, `dict`, `dataclasses`, and `Enum`s.
Compound types are also supported, such as `List[int]`, `Dict[str, int]`, or `List[MyDataclass]`.

```python
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
task = agent.run(
    "Create a sample task for 'Buy groceries'",
    return_type=Task
)
print(f"Task {task.id}: {task.description} (Done: {task.is_done})")

# Get a list of objects
tasks = agent.run(
    "Create 3 sample tasks for a weekend to-do list",
    return_type=List[Task]
)
for t in tasks:
    print(f"- {t.description}")

# Get a dictionary of simple types
counts = agent.run(
    "Count the number of vowels in 'hello world' and return as a dict",
    return_type=Dict[str, int]
)
print(counts)
# Output: {'e': 1, 'o': 2}
```

### 3. Success Criteria & Verification

You can specify success criteria that the agent must meet. The agent will verify its work and automatically retry if the criteria aren't met.

```python
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
    max_verification_rounds=3  # Optional: limit retry attempts (default: 3)
)
print(result)
```

The agent will:
1. Complete the task
2. Verify the result against each criterion
3. If any criterion fails, automatically fix the issues and retry
4. Repeat until all criteria pass or max rounds reached

If verification fails after max rounds, an `AugmentVerificationError` is raised with details about which criteria failed.

### 4. Function Tools

You can give the agent access to your own Python functions. It will call them intelligently to complete tasks.
**Important**: Functions *must* have type hints and docstrings, as these are used to generate the tool definition for the agent.

```python
from auggie_sdk import Auggie
import datetime

def get_current_weather(location: str, unit: str = "celsius") -> dict:
    """
    Gets the weather for a given location.

    Args:
        location: The city and state, e.g. San Francisco, CA
        unit: Temperature unit ('celsius' or 'fahrenheit')
    """
    # In a real app, you'd call a weather API here
    return {"temp": 72, "unit": unit, "forecast": "sunny"}

def get_time() -> str:
    """Returns the current time."""
    return datetime.datetime.now().strftime("%H:%M")

agent = Auggie()

# The agent will call the appropriate function(s) to answer the question
response = agent.run(
    "What's the weather like in NYC right now, and what time is it there?",
    functions=[get_current_weather, get_time]
)

print(response)
```
