# Augment SDK Examples

This directory contains examples demonstrating how to use the Augment Python SDK.

## Basic Examples

### `basic_usage.py`
Demonstrates fundamental SDK features:
- Creating an agent
- Simple text responses
- Typed responses (int, bool, list, dict)
- Dataclass results
- Enum results
- Accessing model explanations
- Session management

**Run it:**
```bash
python examples/basic_usage.py
```

### `session_usage.py`
Shows how to use sessions for conversation continuity:
- Default behavior (independent calls)
- Session behavior (calls remember each other)
- Continuing sessions automatically
- Working with multiple sessions

**Run it:**
```bash
python examples/session_usage.py
```

### `list_prs.py` / `list_prs_2.py`
Examples of working with GitHub PRs using the SDK.

**Run them:**
```bash
python examples/list_prs.py
python examples/list_prs_2.py
```

## ACP Client Examples

### `acp_example_usage.py`
Demonstrates the AuggieACPClient for persistent sessions with the Augment CLI:
- Starting and stopping the agent
- Sending messages with automatic context sharing
- Using event listeners
- Context managers

**Run it:**
```bash
python examples/acp_example_usage.py
```

### Claude Code Client Tests

For ClaudeCodeACPClient examples and testing, see the **real E2E tests**:

**Location:** `tests/test_claude_code_client_e2e.py`

**Prerequisites:**
```bash
npm install -g @zed-industries/claude-code-acp
export ANTHROPIC_API_KEY=...
```

**Run tests:**
```bash
# Quick tests (~30 seconds)
pytest tests/test_claude_code_client_e2e.py

# All tests including slow ones (~5-10 minutes)
pytest tests/test_claude_code_client_e2e.py -m ""
```

**Documentation:**
- [Claude Code Client Guide](../docs/CLAUDE_CODE_CLIENT.md)
- [Testing Guide](../tests/README_CLAUDE_CODE_TESTS.md)

## Prompt-to-SDK Conversion

### `example_complex_prompt.txt`
A sample complex prompt that demonstrates multiple stages, conditions, and iterations. Use this to test the `/prompt-to-sdk` command.

**Example prompt structure:**
```
Analyze all TypeScript files in clients/beachhead/src/cli.

For each file:
1. Check if it has proper error handling
2. Check if it has JSDoc comments
3. Identify potential bugs

After analyzing all files:
1. Create a summary report
2. If >5 files missing error handling, create a plan
3. If >10 files missing JSDoc, generate templates

Finally:
- Count total issues
- Prioritize top 3 critical issues
- Create fix suggestions for top 3
```

**Convert it to SDK code:**
```bash
# In TUI mode
/prompt-to-sdk examples/example_complex_prompt.txt

# From command line
auggie command prompt-to-sdk examples/example_complex_prompt.txt
```

### `demo_prompt_to_sdk.sh`
Interactive demo script that shows the prompt-to-sdk conversion process.

**Run it:**
```bash
./examples/demo_prompt_to_sdk.sh
```

## Workflow Patterns

The examples demonstrate these common patterns:

### 1. Sequential Workflow
```python
with agent.session() as session:
    session("Step 1")
    session("Step 2 that builds on step 1")
    session("Step 3 that uses both")
```

### 2. Conditional Logic
```python
exists = agent("Does file exist?", bool)
if exists:
    agent("Process existing file")
else:
    agent("Create new file")
```

### 3. Iteration with Structured Data
```python
@dataclass
class FileInfo:
    path: str
    size: int

files = agent("Analyze files", list[FileInfo])
for file in files:
    if file.size > 1000:
        agent(f"Optimize {file.path}")
```

### 4. Function Calling
```python
def run_tests(test_file: str) -> dict:
    """
    Run tests from a test file.

    Args:
        test_file: Path to the test file
    """
    # Your test logic
    return {"passed": 10, "failed": 2, "file": test_file}

# Agent can call the function as needed
result = agent.run(
    "Run tests in test_auth.py and analyze the results",
    return_type=dict,
    functions=[run_tests]
)
```

### 5. Error Handling
```python
from auggie_sdk.exceptions import AugmentCLIError, AugmentParseError

try:
    result = agent("Complex task", int)
except AugmentParseError:
    print("Could not parse result")
except AugmentCLIError:
    print("Agent execution failed")
```

## Creating Your Own Examples

### Simple Script Template
```python
#!/usr/bin/env python3
"""
Description of what this script does.
"""

from auggie_sdk import Auggie

def main():
    # Create agent
    agent = Auggie(workspace_root=".", model="claude-3-5-sonnet-latest")

    # Your workflow here
    result = agent("Your instruction")
    print(f"Result: {result}")

if __name__ == "__main__":
    main()
```

### Complex Workflow Template
```python
#!/usr/bin/env python3
"""
Multi-stage workflow with structured data.
"""

from auggie_sdk import Auggie
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class YourDataClass:
    field1: str
    field2: int

def main():
    agent = Auggie(workspace_root=".", model="claude-3-5-sonnet-latest")

    # Stage 1: Get structured data
    items = agent("Get items", list[YourDataClass])
    print(f"Found {len(items)} items")

    # Stage 2: Process with session
    with agent.session() as session:
        for item in items:
            session(f"Process {item.field1}")

    # Stage 3: Final report
    agent("Create summary report")
    print("Workflow complete!")

if __name__ == "__main__":
    main()
```

## Testing Examples

All examples can be run directly:

```bash
# Run a specific example
python examples/basic_usage.py

# Run with custom workspace
python examples/basic_usage.py --workspace /path/to/workspace

# Run with different model
python examples/basic_usage.py --model gpt-4o
```

## Documentation

- **SDK README**: `../README.md`
- **Prompt-to-SDK Guide**: `../PROMPT_TO_SDK_GUIDE.md`
- **Slash Command Summary**: `../SLASH_COMMAND_SUMMARY.md`

## Getting Help

If you encounter issues:

1. Check that the SDK is installed: `pip install -e .`
2. Verify auggie CLI is available: `auggie --version`
3. Check the workspace path is correct
4. Review error messages for specific issues

For more help, see the main SDK documentation.
