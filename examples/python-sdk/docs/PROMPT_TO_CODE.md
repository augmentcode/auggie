# Prompt to Code Converter

The `prompt_to_code.py` tool converts complex, multi-stage prompts into well-structured Python programs using the Augment SDK. This allows you to express complex workflows with conditions, loops, and multiple stages as code rather than a single monolithic prompt.

## Why Convert Prompts to SDK Programs?

Complex prompts often involve:
- **Sequential stages** that build on each other
- **Conditional logic** based on intermediate results
- **Loops** over collections of items
- **Data dependencies** between steps
- **Validation** and error handling

Converting these to SDK programs gives you:
- ✅ **Better control** over workflow execution
- ✅ **Type safety** with Python's type system
- ✅ **Debugging** capabilities with standard Python tools
- ✅ **Reusability** - run the same workflow multiple times
- ✅ **Maintainability** - easier to modify and extend
- ✅ **Visibility** - see exactly what's happening at each stage

## Installation

Make sure the Augment SDK is installed:

```bash
cd experimental/guy/auggie_sdk
pip install -e .
```

## Usage

### Basic Usage

```bash
python prompt_to_code.py <path-to-prompt-file>
```

This will:
1. Read your prompt from the file
2. Analyze its structure
3. Generate a Python program using the Augment SDK
4. Save it to `generated_sdk_program.py` (or a numbered variant)

### With Custom Output File

```bash
python prompt_to_code.py my_prompt.txt --output my_workflow.py
```

### With Custom Model

```bash
python prompt_to_code.py my_prompt.txt --model claude-3-5-sonnet-latest
```

### With Custom Workspace

```bash
python prompt_to_code.py my_prompt.txt --workspace /path/to/workspace
```

## Example

Given a prompt file `example_prompt.txt`:

```
Analyze all Python files in the src/ directory, identify any security
vulnerabilities or code quality issues, create a detailed report in
markdown format, and if there are any critical security issues found,
generate fix suggestions for each one with specific code changes needed.
```

Run the converter:

```bash
python prompt_to_code.py examples/example_prompt.txt
```

This generates a Python program like:

```python
#!/usr/bin/env python3
"""
Security analysis workflow for Python files.
"""

from auggie_sdk import Auggie
from dataclasses import dataclass
from typing import List

@dataclass
class SecurityIssue:
    file: str
    severity: str
    description: str
    line_number: int

def main():
    agent = Auggie(workspace_root=".", model="claude-3-5-sonnet-latest")

    # Stage 1: Get list of Python files
    files = agent("List all Python files in src/ directory", list[str])
    print(f"Found {len(files)} Python files to analyze")

    # Stage 2: Analyze each file for security issues
    all_issues: List[SecurityIssue] = []
    with agent.session() as session:
        for file in files:
            issues = session(
                f"Analyze {file} for security vulnerabilities. "
                f"Return a list of issues found.",
                list[SecurityIssue]
            )
            all_issues.extend(issues)

    print(f"Found {len(all_issues)} total security issues")

    # Stage 3: Create report
    agent(f"Create a security report in security_report.md summarizing "
          f"the {len(all_issues)} issues found across {len(files)} files")

    # Stage 4: Generate fixes for critical issues
    critical_issues = [i for i in all_issues if i.severity == "critical"]

    if critical_issues:
        print(f"Found {len(critical_issues)} critical issues - generating fixes")
        with agent.session() as session:
            for issue in critical_issues:
                session(
                    f"Create a fix for the critical security issue in {issue.file} "
                    f"at line {issue.line_number}: {issue.description}"
                )
    else:
        print("No critical issues found!")

if __name__ == "__main__":
    main()
```

## How It Works

The converter analyzes your prompt and identifies patterns:

### 1. Sequential Stages with Context

When steps build on each other, it uses sessions:

```python
with agent.session() as session:
    session("Step 1: Create the base structure")
    session("Step 2: Add features to what we just created")
    session("Step 3: Test everything we built")
```

### 2. Conditional Logic

When decisions are needed, it uses typed results:

```python
result = agent("Check if the file exists", bool)
if result:
    agent("Process the existing file")
else:
    agent("Create a new file first")
```

### 3. Loops/Iterations

When operating on collections:

```python
files = agent("List all Python files in src/", list[str])
for file in files:
    agent(f"Review {file} for security issues")
```

### 4. Data Dependencies

When steps need structured data from previous steps:

```python
@dataclass
class FileInfo:
    path: str
    size: int
    type: str

files = agent("Analyze all config files", list[FileInfo])
for file in files:
    if file.size > 1000:
        agent(f"Optimize {file.path} - it's {file.size} bytes")
```

### 5. Function Calling

When the agent needs to interact with external systems:

```python
def run_tests(test_file: str) -> dict:
    """Run tests and return results."""
    # Your test execution logic
    return {"passed": 10, "failed": 2, "file": test_file}

result = agent.run(
    "Run all tests and analyze failures",
    return_type=dict,
    functions=[run_tests]
)
```

## Command-Line Options

```
usage: prompt_to_code.py [-h] [-o OUTPUT] [-m MODEL] [-w WORKSPACE] prompt_file

Convert a complex prompt into an Augment SDK program

positional arguments:
  prompt_file           Path to the file containing the prompt to convert

optional arguments:
  -h, --help            show this help message and exit
  -o OUTPUT, --output OUTPUT
                        Output file path for the generated program (default: auto-generated)
  -m MODEL, --model MODEL
                        Model to use for conversion (default: claude-3-5-sonnet-latest)
  -w WORKSPACE, --workspace WORKSPACE
                        Workspace root directory (default: current directory)
```

## Tips for Writing Good Prompts

To get the best SDK programs, write prompts that clearly describe:

1. **The stages** - What are the distinct steps?
2. **The data flow** - What information passes between steps?
3. **The conditions** - When should different actions be taken?
4. **The iterations** - What collections need to be processed?
5. **The outputs** - What should be created or returned?

### Good Prompt Example

```
First, scan all TypeScript files in the components/ directory and identify
which ones are missing unit tests. For each file without tests, create a
comprehensive test file with at least 80% coverage. Then run all the new
tests and if any fail, fix the issues. Finally, generate a summary report
of test coverage improvements.
```

This clearly shows:
- Sequential stages (scan → create tests → run tests → fix → report)
- Iteration (for each file without tests)
- Conditional logic (if any fail)
- Data dependencies (which files need tests)

### Less Ideal Prompt Example

```
Make the codebase better with tests and stuff.
```

This is too vague and doesn't provide enough structure for conversion.

## After Generation

Once you have your generated SDK program:

1. **Review the code** - Make sure it matches your intent
2. **Customize as needed** - Add error handling, logging, etc.
3. **Test it** - Run it on a small subset first
4. **Iterate** - Modify the program based on results
5. **Reuse it** - Run the same workflow whenever needed

## See Also

- [Agent Documentation](./AGENT_EVENT_LISTENER.md)
- [Session Continuity](./SESSION_CONTINUITY.md)
- [Function Calling](./FUNCTION_CALLING.md)
- [Type Inference](./AUTOMATIC_TYPE_INFERENCE.md)
