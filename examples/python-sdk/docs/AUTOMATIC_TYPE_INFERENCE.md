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
- If `return_type` is None: Returns tuple of `(result, inferred_type)`

## Examples

### Automatic Type Inference

```python
from auggie_sdk import Auggie

agent = Auggie()

# Agent automatically determines the type
result, inferred_type = agent.run("What is 2 + 2?")
print(f"Result: {result}, Type: {inferred_type.__name__}")
# Output: Result: 4, Type: int

result, inferred_type = agent.run("List the primary colors")
print(f"Result: {result}, Type: {inferred_type.__name__}")
# Output: Result: ['red', 'blue', 'yellow'], Type: list

result, inferred_type = agent.run("Is Python statically typed?")
print(f"Result: {result}, Type: {inferred_type.__name__}")
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

## Implementation Details

### Core Changes

1. **Added `DEFAULT_INFERENCE_TYPES` constant** in `augment/agent.py`:
   ```python
   DEFAULT_INFERENCE_TYPES = [int, float, bool, str, list, dict]
   ```

2. **Modified `run()` method** to use automatic type inference when `return_type` is None:
   ```python
   if return_type is None:
       # Type inference mode with default types
       return self._run_with_type_inference(
           client,
           instruction,
           DEFAULT_INFERENCE_TYPES,
           effective_timeout,
           max_retries,
       )
   ```

3. **Removed `infer_type` parameter** from the `run()` method signature

4. **Updated return type annotation** to reflect the new behavior:
   ```python
   -> Union[T, tuple[T, Type[T]]]
   ```

### Test Updates

- Updated all tests that call `agent.run()` without `return_type` to expect tuple returns
- Added helper function `make_type_inference_response()` for creating mock responses
- Renamed tests from `test_run_type_inference_*` to `test_run_automatic_type_inference_*`
- All 49 unit tests passing

### Documentation Updates

- Updated README.md with automatic type inference examples
- Added dedicated section explaining the feature
- Updated API reference
- Updated examples in `examples/basic_usage.py`

## Benefits

1. **Simpler API**: No need to specify `infer_type` parameter
2. **More Intelligent**: Agent automatically chooses the best type
3. **Backward Compatible**: Explicit `return_type` still works as before
4. **Better UX**: Natural behavior - when you don't specify a type, the agent figures it out

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

## Files Modified

1. `augment/agent.py` - Core implementation
2. `tests/test_agent.py` - Test updates
3. `README.md` - Documentation
4. `examples/basic_usage.py` - Example updates
5. `pyproject.toml` - Fixed duplicate `[project.optional-dependencies]` section

## Testing

All tests pass:
```bash
cd experimental/guy/auggie_sdk
python3 -m pytest tests/test_agent.py -v
# 49 passed in 0.16s
```
