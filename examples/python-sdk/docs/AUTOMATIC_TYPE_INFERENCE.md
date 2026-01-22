# Automatic Type Inference

## Summary

The Agent class now automatically infers the type of responses when no `return_type` is specified. This makes the SDK more intelligent and user-friendly by eliminating the need to explicitly specify types for common use cases.

## Changes Made

### 1. Removed `infer_type` Parameter

**Before:**
```python
# Explicit type inference with infer_type parameter
result, chosen_type = agent.run("What is 2 + 2?", infer_type=[int, str, bool])
```

**After:**
```python
# Automatic type inference (no parameter needed)
result, chosen_type = agent.run("What is 2 + 2?")
```

### 2. New Default Behavior

When `return_type` is not specified, the agent automatically:
1. Infers the best type from a default set of common types
2. Returns a tuple of `(result, inferred_type)`

**Default inference types:**
- `int`
- `float`
- `bool`
- `str`
- `list`
- `dict`

### 3. Updated API

**`Agent.run()` signature:**
```python
def run(
    self,
    instruction: str,
    return_type: Type[T] = None,  # infer_type parameter removed
    timeout: Optional[int] = None,
    max_retries: int = 3,
) -> Union[T, tuple[T, Type[T]]]:
```

**Return values:**
- If `return_type` is specified: Returns parsed result of that type
- If `return_type` is None: Returns result with automatically inferred type (use `type(result)` to inspect)

## Examples

### Automatic Type Inference

```python
from auggie_sdk import Auggie

agent = Auggie()

# Agent automatically determines the type
result = agent.run("What is 2 + 2?")
print(f"Result: {result}, Type: {type(result).__name__}")
# Output: Result: 4, Type: int

result = agent.run("List the primary colors")
print(f"Result: {result}, Type: {type(result).__name__}")
# Output: Result: ['red', 'blue', 'yellow'], Type: list

result = agent.run("Is Python statically typed?")
print(f"Result: {result}, Type: {type(result).__name__}")
# Output: Result: False, Type: bool
```

### Explicit Type Specification

```python
# Still works as before - specify exact type
result = agent.run("What is 2 + 2?", return_type=int)
print(f"Result: {result}")  # Result: 4

# Works with complex types
from dataclasses import dataclass

@dataclass
class Task:
    title: str
    priority: str

task = agent.run("Create a task", return_type=Task)
print(f"Task: {task.title}")
```

## Migration Guide

### If you were using `infer_type`:

**Before:**
```python
result, chosen_type = agent.run("What is 2 + 2?", infer_type=[int, str, bool])
```

**After:**
```python
# Just remove the infer_type parameter
result, chosen_type = agent.run("What is 2 + 2?")
```

### If you were calling `run()` without any type:

**Before:**
```python
response = agent.run("Hello")  # Returns string
```

**After:**
```python
result, inferred_type = agent.run("Hello")  # Returns tuple
# Or unpack just the result if you don't need the type
result, _ = agent.run("Hello")
```

## See Also

- [Typed Returns](./TYPED_RETURNS.md)
- [Function Calling](./FUNCTION_CALLING.md)
- [Agent Event Listener](./AGENT_EVENT_LISTENER.md)
