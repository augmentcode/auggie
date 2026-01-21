#!/usr/bin/env python3
"""
Convert a complex prompt into an Augment SDK program.

This tool analyzes a complex, multi-stage prompt and converts it into a
well-structured Python program using the Augment SDK. This allows complex
workflows with conditions, loops, and multiple stages to be expressed as
code rather than a single monolithic prompt.

Usage:
    python prompt_to_code.py <path-to-prompt-file> [--output OUTPUT_FILE] [--model MODEL]

Examples:
    python prompt_to_code.py my_prompt.txt
    python prompt_to_code.py my_prompt.txt --output generated_script.py
    python prompt_to_code.py my_prompt.txt --model claude-3-5-sonnet-latest
"""

import argparse
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

# Add the parent directory to the path so we can import auggie_sdk
sys.path.insert(0, str(Path(__file__).parent))

from auggie_sdk import Auggie
from auggie_sdk.exceptions import AugmentCLIError, AugmentParseError


CONVERSION_PROMPT = """
Analyze this complex prompt and convert it into a well-structured Python program using the Augment SDK.

## The Prompt to Convert:

{prompt_content}

## Your Task:

1. **Analyze the prompt structure** and identify:
   - Sequential stages that must happen in order
   - Conditional logic based on previous results
   - Loops/iterations over collections
   - Data dependencies between steps
   - Validation/error handling needs
   - Context requirements (when steps need to remember previous work)

2. **Design the SDK program** using these patterns:

   **IMPORTANT: Agent API**
   - Use `agent.run(prompt)` or `agent.run(prompt, return_type=Type)` to run tasks
   - DO NOT call `agent()` directly - Agent is not callable
   - Use `agent.session()` for multi-step workflows with shared context

   **For Sequential Stages with Context:**
   ```python
   with agent.session() as session:
       session.run("Step 1: Create the base structure")
       session.run("Step 2: Add features to what we just created")
       session.run("Step 3: Test everything we built")
   ```

   **For Conditional Logic:**
   ```python
   result = agent.run("Check if the file exists", return_type=bool)
   if result:
       agent.run("Process the existing file")
   else:
       agent.run("Create a new file first")
   ```

   **For Loops/Iterations:**
   ```python
   files = agent.run("List all Python files in src/", return_type=list[str])
   for file in files:
       agent.run(f"Review {{file}} for security issues")
   ```

   **For Data Dependencies:**
   ```python
   @dataclass
   class FileInfo:
       path: str
       size: int
       type: str

   files = agent.run("Analyze all config files", return_type=list[FileInfo])
   for file in files:
       if file.size > 1000:
           agent.run(f"Optimize {{file.path}} - it's {{file.size}} bytes")
   ```

   **For Function Calling:**
   ```python
   def run_tests(test_file: str) -> dict:
       \"\"\"Run tests and return results.\"\"\"
       # Your test execution logic
       return {{"passed": 10, "failed": 2, "file": test_file}}

   result = agent.run(
       "Run all tests and analyze failures",
       return_type=dict,
       functions=[run_tests]
   )
   ```

3. **Generate a complete, runnable Python program** that:
   - Imports necessary modules (from auggie_sdk import Agent, dataclasses, typing, etc.)
   - Defines any dataclasses for structured data
   - Creates the agent with: `agent = Auggie(workspace_root=".")` or `agent = Auggie()`
   - IMPORTANT: Agent() takes optional keyword arguments only: workspace_root, model, listener
   - DO NOT pass positional arguments to Agent()
   - Implements the workflow using the patterns above
   - Includes error handling and logging
   - Adds comments explaining each stage
   - Provides a main() function that can be run directly
   - Includes a proper shebang and docstring

4. **Guidelines:**
   - Use sessions when multiple related steps build on each other
   - Use typed results when you need to make decisions or iterate
   - Use function calling when the agent needs to interact with external systems
   - Break into multiple calls for each logical stage
   - Keep as single call only for simple, atomic operations

5. **Output Format:**
   Return ONLY the complete Python program code, with no additional explanation.
   The code should be ready to save to a file and run immediately.
   Start with #!/usr/bin/env python3 and include a proper docstring.
"""


@dataclass
class ConversionResult:
    """Result of converting a prompt to SDK code."""

    code: str
    success: bool
    error: Optional[str] = None


def read_prompt_file(file_path: str) -> str:
    """Read the prompt from a file."""
    try:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Prompt file not found: {file_path}")

        return path.read_text(encoding="utf-8")
    except Exception as e:
        raise RuntimeError(f"Failed to read prompt file: {e}")


def convert_prompt_to_code(
    prompt_content: str,
    model: str = "claude-3-5-sonnet-latest",
    workspace_root: Optional[str] = None,
) -> ConversionResult:
    """
    Convert a prompt to an Augment SDK program.

    Args:
        prompt_content: The prompt text to convert
        model: The model to use for conversion
        workspace_root: Optional workspace root directory

    Returns:
        ConversionResult with the generated code or error
    """
    try:
        # Create agent for conversion
        agent = Auggie(model=model, workspace_root=workspace_root or str(Path.cwd()))

        # Format the conversion prompt
        full_prompt = CONVERSION_PROMPT.format(prompt_content=prompt_content)

        # Get the generated code
        print("🤖 Analyzing prompt and generating SDK program...")
        code = agent.run(full_prompt, return_type=str, timeout=120)

        return ConversionResult(code=code, success=True)

    except AugmentParseError as e:
        return ConversionResult(
            code="", success=False, error=f"Failed to parse agent response: {e}"
        )
    except AugmentCLIError as e:
        return ConversionResult(
            code="", success=False, error=f"Agent execution failed: {e}"
        )
    except Exception as e:
        return ConversionResult(code="", success=False, error=f"Unexpected error: {e}")


def save_generated_code(code: str, output_file: Optional[str] = None) -> str:
    """
    Save the generated code to a file.

    Args:
        code: The generated Python code
        output_file: Optional output file path. If None, generates a name.

    Returns:
        The path where the code was saved
    """
    if output_file:
        output_path = Path(output_file)
    else:
        # Generate a default output filename
        output_path = Path("generated_sdk_program.py")
        counter = 1
        while output_path.exists():
            output_path = Path(f"generated_sdk_program_{counter}.py")
            counter += 1

    output_path.write_text(code, encoding="utf-8")

    # Make the file executable
    output_path.chmod(0o755)

    return str(output_path)


def main():
    """Main entry point for the prompt-to-code converter."""
    parser = argparse.ArgumentParser(
        description="Convert a complex prompt into an Augment SDK program",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s my_prompt.txt
  %(prog)s my_prompt.txt --output generated_script.py
  %(prog)s my_prompt.txt --model claude-3-5-sonnet-latest
        """,
    )

    parser.add_argument(
        "prompt_file", help="Path to the file containing the prompt to convert"
    )

    parser.add_argument(
        "-o",
        "--output",
        help="Output file path for the generated program (default: auto-generated)",
        default=None,
    )

    parser.add_argument(
        "-m",
        "--model",
        help="Model to use for conversion (default: claude-3-5-sonnet-latest)",
        default="claude-3-5-sonnet-latest",
    )

    parser.add_argument(
        "-w",
        "--workspace",
        help="Workspace root directory (default: current directory)",
        default=None,
    )

    args = parser.parse_args()

    try:
        # Read the prompt file
        print(f"📖 Reading prompt from: {args.prompt_file}")
        prompt_content = read_prompt_file(args.prompt_file)
        print(f"✅ Read {len(prompt_content)} characters")

        # Convert the prompt
        result = convert_prompt_to_code(
            prompt_content, model=args.model, workspace_root=args.workspace
        )

        if not result.success:
            print(f"❌ Conversion failed: {result.error}", file=sys.stderr)
            return 1

        # Save the generated code
        output_path = save_generated_code(result.code, args.output)
        print(f"✅ Generated SDK program saved to: {output_path}")

        # Print usage instructions
        print("\n" + "=" * 60)
        print("📝 Usage Instructions:")
        print("=" * 60)
        print(f"1. Review the generated code: {output_path}")
        print(f"2. Run the program: python {output_path}")
        print("3. Modify as needed for your specific use case")
        print("\n💡 The generated program uses the Augment SDK.")
        print("   Make sure it's installed: pip install auggie-sdk")

        return 0

    except FileNotFoundError as e:
        print(f"❌ {e}", file=sys.stderr)
        return 1
    except RuntimeError as e:
        print(f"❌ {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\n⚠️  Conversion interrupted by user", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"❌ Unexpected error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
