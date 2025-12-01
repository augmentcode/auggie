# Prompt to Code Converter Examples

This directory contains examples for using the `prompt_to_code.py` tool.

## Quick Start

1. **Create a prompt file** describing your workflow:

```bash
cat > my_workflow.txt << 'EOF'
Analyze all Python files in the src/ directory, identify any security
vulnerabilities or code quality issues, create a detailed report in
markdown format, and if there are any critical security issues found,
generate fix suggestions for each one with specific code changes needed.
EOF
```

2. **Convert the prompt to an SDK program**:

```bash
python ../prompt_to_code.py my_workflow.txt
```

3. **Review and run the generated program**:

```bash
# Review the generated code
cat generated_sdk_program.py

# Run it
python generated_sdk_program.py
```

## Example Prompts

### Example 1: Security Analysis (included)

See `example_prompt.txt` for a simple security analysis workflow.

```bash
python ../prompt_to_code.py example_prompt.txt --output security_analyzer.py
```

### Example 2: Test Generation Workflow

Create a file `test_generation.txt`:

```
First, scan all TypeScript files in the components/ directory and identify
which ones are missing unit tests. For each file without tests, create a
comprehensive test file with at least 80% coverage. Then run all the new
tests and if any fail, fix the issues. Finally, generate a summary report
of test coverage improvements.
```

Convert it:

```bash
python ../prompt_to_code.py test_generation.txt --output test_generator.py
```

### Example 3: Documentation Generator

Create a file `doc_generator.txt`:

```
Analyze all public functions and classes in the src/ directory. For each
one that's missing a docstring or has an incomplete docstring, generate
comprehensive documentation including description, parameters, return
values, and usage examples. Then validate that all docstrings follow
Google style guide format.
```

Convert it:

```bash
python ../prompt_to_code.py doc_generator.txt --output doc_generator.py
```

### Example 4: Code Refactoring Pipeline

Create a file `refactor_pipeline.txt`:

```
Find all functions in the codebase that are longer than 50 lines. For
each one, analyze if it can be broken down into smaller functions. If
yes, refactor it into multiple well-named functions with clear
responsibilities. After each refactoring, run the existing tests to
ensure nothing broke. Keep a log of all refactorings performed.
```

Convert it:

```bash
python ../prompt_to_code.py refactor_pipeline.txt --output refactor_pipeline.py
```

## Tips for Writing Good Prompts

### ✅ Good Prompts

Good prompts clearly describe:
- **Sequential stages**: What happens first, second, third?
- **Data flow**: What information passes between steps?
- **Conditions**: When should different actions be taken?
- **Iterations**: What collections need processing?
- **Outputs**: What should be created?

Example:
```
First, list all Python files in src/. For each file, check if it has
type hints. If not, add type hints. Then run mypy to validate. If
there are errors, fix them. Finally, create a report of all changes.
```

This shows:
- Clear stages (list → check → add → validate → fix → report)
- Iteration (for each file)
- Conditions (if not, if errors)
- Output (report)

### ❌ Less Effective Prompts

Avoid vague prompts like:
```
Make the code better
```

This doesn't provide enough structure for conversion.

## Advanced Usage

### Custom Model

Use a specific model for conversion:

```bash
python ../prompt_to_code.py my_prompt.txt --model claude-3-5-sonnet-latest
```

### Custom Workspace

Specify a workspace directory:

```bash
python ../prompt_to_code.py my_prompt.txt --workspace /path/to/project
```

### Custom Output Location

Save to a specific file:

```bash
python ../prompt_to_code.py my_prompt.txt --output ~/my_scripts/workflow.py
```

## What Gets Generated

The tool generates a complete Python program with:

1. **Proper shebang and docstring**
2. **All necessary imports** (Agent, dataclasses, typing, etc.)
3. **Dataclass definitions** for structured data
4. **Agent initialization** with appropriate settings
5. **Workflow implementation** using SDK patterns:
   - Sessions for context continuity
   - Typed results for decision-making
   - Loops for iteration
   - Error handling
6. **Main function** that can be run directly
7. **Helpful comments** explaining each stage

## Modifying Generated Programs

After generation, you can:

1. **Add error handling**:
```python
try:
    result = agent("Some operation", int)
except AugmentCLIError as e:
    print(f"Error: {e}")
```

2. **Add logging**:
```python
import logging
logging.basicConfig(level=logging.INFO)
logging.info(f"Processing {len(files)} files")
```

3. **Add function calling**:
```python
def run_tests(file: str) -> dict:
    """Run tests for a file."""
    # Your implementation
    return {"passed": 10, "failed": 0}

result = agent.run(
    "Run tests and analyze results",
    return_type=dict,
    functions=[run_tests]
)
```

4. **Add event listeners**:
```python
from auggie_sdk import LoggingAgentListener

listener = LoggingAgentListener(verbose=True)
agent = Auggie(listener=listener)
```

## See Also

- [Main Documentation](../docs/PROMPT_TO_CODE.md)
- [Agent Documentation](../docs/AGENT_EVENT_LISTENER.md)
- [Session Continuity](../docs/SESSION_CONTINUITY.md)
- [Function Calling](../docs/FUNCTION_CALLING.md)
