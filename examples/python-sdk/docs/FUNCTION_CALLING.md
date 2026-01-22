# Function Calling Feature

## Overview

The Augment Python SDK now supports **function calling**, allowing you to provide Python functions that the agent can invoke during execution. This enables the agent to interact with external systems, perform calculations, fetch data, and more.

## How It Works

### 1. Function Definition

Define Python functions with type hints and docstrings:

```python
def get_weather(location: str, unit: str = "celsius") -> dict:
    """
    Get the current weather for a location.

    Args:
        location: City name or coordinates
        unit: Temperature unit (celsius or fahrenheit)
    """
    # Your implementation
    return {"temp": 22, "condition": "sunny"}
```

### 2. Pass Functions to Agent

```python
from auggie_sdk import Auggie

agent = Auggie()

result = agent.run(
    "What's the weather in San Francisco?",
    return_type=dict,
    functions=[get_weather]
)
```

### 3. Agent Workflow

1. Function schemas are added to the instruction prompt
2. Agent receives instruction and can call functions as needed
3. If agent calls a function, it returns:
   ```
   <function-call>
   {
     "name": "get_weather",
     "arguments": {"location": "San Francisco", "unit": "celsius"}
   }
   </function-call>
   ```
4. SDK parses the function call and executes the function
5. SDK sends results back to agent in the same conversation
6. Agent continues with the response (can call more functions if needed)
7. Final response is parsed according to `return_type`

This all happens in the normal code path - function calling is integrated seamlessly.

## Function Requirements

For functions to work properly with the agent:

1. **Type Hints**: All parameters should have type hints
   ```python
   def my_func(param1: str, param2: int) -> dict:
   ```

2. **Docstrings**: Include parameter descriptions in docstring
   ```python
   """
   Function description.

   Args:
       param1: Description of param1
       param2: Description of param2
   """
   ```

3. **Return Type**: Specify return type hint
   ```python
   def my_func(...) -> dict:
   ```

## Supported Types

The schema generator supports:
- Basic types: `str`, `int`, `float`, `bool`
- Collections: `list`, `dict`, `List[T]`, `Dict[K, V]`
- Optional types: `Optional[T]`
- Union types: `Union[T1, T2]`
- Any type: `Any`

## Examples

### Simple Calculation

```python
def add_numbers(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b

result = agent.run(
    "What is 15 + 27?",
    return_type=int,
    functions=[add_numbers]
)
```

### Multiple Functions

```python
def multiply(a: int, b: int) -> int:
    """Multiply two numbers."""
    return a * b

def divide(a: int, b: int) -> float:
    """Divide two numbers."""
    return a / b

result = agent.run(
    "Calculate (10 * 5) / 2",
    return_type=float,
    functions=[multiply, divide]
)
```

### Complex Workflow

```python
def fetch_data(source: str) -> list:
    """Fetch data from a source."""
    return [{"id": 1, "value": 100}, {"id": 2, "value": 200}]

def process_data(data: list) -> dict:
    """Process the fetched data."""
    total = sum(item["value"] for item in data)
    return {"count": len(data), "total": total}

result = agent.run(
    "Fetch data from 'api' and process it",
    return_type=dict,
    functions=[fetch_data, process_data]
)
```

## Error Handling

If a function raises an exception, the error is caught and returned to the agent:

```python
def failing_function(x: int) -> int:
    """A function that might fail."""
    if x < 0:
        raise ValueError("x must be positive")
    return x * 2

# Agent will receive error message and can handle it
result = agent.run(
    "Call failing_function with x=-5",
    return_type=str,
    functions=[failing_function]
)
```

## Limitations

1. **Maximum Rounds**: Function calling is limited to 5 rounds to prevent infinite loops
2. **Function Signature**: Functions must be callable with keyword arguments
3. **Serialization**: Function arguments and return values must be JSON-serializable
4. **No Nested Calls**: Functions cannot call other provided functions directly

## Testing

Run the tests:

```bash
# Install the SDK
pip install auggie-sdk

# Run the function calling example
cd examples/python-sdk
python3 function_calling_example.py
```

## Implementation Details

### Function Schema Format

Functions are converted to this schema format:

```json
{
  "name": "function_name",
  "description": "Function description from docstring",
  "parameters": {
    "type": "object",
    "properties": {
      "param1": {
        "type": "string",
        "description": "Parameter description"
      }
    },
    "required": ["param1"]
  }
}
```

### Agent Protocol

The agent uses XML tags to indicate function calls:

```xml
<function-call>
{
  "name": "function_name",
  "arguments": {"param": "value"}
}
</function-call>
```

Multiple function calls can be made in a single response.

## Future Enhancements

Potential improvements:
- Support for async functions
- Streaming function results
- Function call history/logging
- Better error recovery
- Function call validation before execution
- Support for more complex type hints (TypedDict, Literal, etc.)

## See Also

- [Automatic Type Inference](./AUTOMATIC_TYPE_INFERENCE.md)
- [Agent Event Listener](./AGENT_EVENT_LISTENER.md)
- [Prompt to Code](./PROMPT_TO_CODE.md)
