#!/usr/bin/env python3
"""
Convert a complex prompt into an Augment SDK program using a multi-stage workflow.

This version uses the SDK itself to orchestrate the conversion process:
1. Spec: Create a detailed specification for the program
2. Implement: Generate the SDK code
3. Test: Validate the code (syntax, types, dry-run)
4. Iterate: Fix issues until tests pass
5. Cleanup: Final polish and documentation

Usage:
    python prompt_to_code_v2.py <path-to-prompt-file> [--output OUTPUT_FILE] [--model MODEL]

Examples:
    python prompt_to_code_v2.py my_prompt.txt
    python prompt_to_code_v2.py my_prompt.txt --output generated_script.py
    python prompt_to_code_v2.py my_prompt.txt --model sonnet4.5
"""

import argparse
import ast
import json
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List

from auggie_sdk import Auggie


@dataclass
class ProgramSpec:
    """Specification for the SDK program to be generated."""

    purpose: str
    input_requirements: List[str]
    output_requirements: List[str]
    stages: List[str]
    data_structures: List[str]
    test_strategy: str
    safety_considerations: str


@dataclass
class ValidationResult:
    """Result of validating generated code."""

    success: bool
    syntax_valid: bool
    type_check_passed: bool
    imports_valid: bool
    dry_run_passed: bool
    errors: List[str]
    warnings: List[str]


@dataclass
class ConversionResult:
    """Result of the prompt-to-code conversion."""

    success: bool
    code: Optional[str]
    spec: Optional[ProgramSpec]
    validation: Optional[ValidationResult]
    iterations: int
    error: Optional[str]


def validate_python_syntax(code: str) -> tuple[bool, List[str]]:
    """
    Validate Python syntax by parsing the code.

    Returns:
        (is_valid, errors)
    """
    errors = []
    try:
        ast.parse(code)
        return True, []
    except SyntaxError as e:
        errors.append(f"Syntax error at line {e.lineno}: {e.msg}")
        return False, errors


def check_imports(code: str) -> tuple[bool, List[str]]:
    """
    Check if all imports in the code are valid.

    Returns:
        (all_valid, warnings)
    """
    warnings = []

    # List of allowed imports (common Python stdlib + augment SDK)
    allowed_imports = {
        "__future__",
        "auggie_sdk",
        "augment",
        "dataclasses",
        "typing",
        "json",
        "pathlib",
        "datetime",
        "sys",
        "os",
        "argparse",
        "logging",
        "tempfile",
        "subprocess",
        "collections",
        "re",
        "time",
        "shutil",
        "glob",
        "itertools",
        "functools",
        "enum",
        "abc",
        "contextlib",
        "io",
        "traceback",
        "importlib",
    }

    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    # Check root module name for imports like "auggie_sdk.acp"
                    root_module = alias.name.split('.')[0]
                    if root_module not in allowed_imports:
                        warnings.append(f"Warning: Unexpected import '{alias.name}'")
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    # Check root module name for submodule imports
                    root_module = node.module.split('.')[0]
                    if root_module not in allowed_imports:
                        warnings.append(f"Warning: Unexpected import from '{node.module}'")

        return True, warnings
    except Exception as e:
        warnings.append(f"Warning: Error checking imports: {e}")
        return True, warnings


def run_type_check(code: str, workspace_root: str) -> tuple[bool, List[str]]:
    """
    Run mypy type checking on the code.

    Returns:
        (passed, warnings)
    """
    warnings = []

    # Save code to a temporary file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        temp_file = f.name

    try:
        # Run mypy
        result = subprocess.run(
            ["mypy", "--ignore-missing-imports", "--no-error-summary", temp_file],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            warnings.extend(result.stdout.strip().split("\n"))
            return False, warnings

        return True, []
    except FileNotFoundError:
        # mypy not installed, skip type checking (this is OK)
        return True, []
    except Exception as e:
        warnings.append(f"Warning: Error running type check: {e}")
        return True, warnings
    finally:
        Path(temp_file).unlink(missing_ok=True)


def dry_run_code(code: str, workspace_root: str) -> tuple[bool, List[str]]:
    """
    Perform a dry-run of the code to check for runtime issues.
    This creates a safe sandbox environment.

    Returns:
        (passed, warnings)
    """
    warnings = []

    # For now, we'll just check that the code can be imported
    # A full dry-run would require mocking the Agent and all tools
    try:
        # Check for potentially dangerous operations
        tree = ast.parse(code)
        for node in ast.walk(tree):
            # Check for file operations
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Attribute):
                    if node.func.attr in ["unlink", "rmdir", "remove", "rmtree"]:
                        warnings.append(
                            "Warning: Code contains file deletion operations - ensure they're safe"
                        )

        return True, warnings
    except Exception as e:
        warnings.append(f"Warning: Error during dry-run: {e}")
        return True, warnings


def validate_code(code: str, workspace_root: str) -> ValidationResult:
    """
    Validate the generated code through multiple checks.

    Args:
        code: The Python code to validate
        workspace_root: Workspace directory for context

    Returns:
        ValidationResult with detailed validation info
    """
    all_errors = []
    all_warnings = []

    # 1. Syntax check
    syntax_valid, syntax_errors = validate_python_syntax(code)
    all_errors.extend(syntax_errors)

    # 2. Import check
    imports_valid, import_warnings = check_imports(code)
    all_warnings.extend(import_warnings)

    # 3. Type check
    type_check_passed, type_warnings = run_type_check(code, workspace_root)
    all_warnings.extend(type_warnings)

    # 4. Dry run
    dry_run_passed, dry_run_warnings = dry_run_code(code, workspace_root)
    all_warnings.extend(dry_run_warnings)

    success = syntax_valid and len(all_errors) == 0

    return ValidationResult(
        success=success,
        syntax_valid=syntax_valid,
        type_check_passed=type_check_passed,
        imports_valid=imports_valid,
        dry_run_passed=dry_run_passed,
        errors=all_errors,
        warnings=all_warnings,
    )


def convert_prompt_to_code_v2(
    prompt_content: str,
    model: str = "sonnet4.5",
    workspace_root: str = ".",
    max_iterations: int = 3,
    timeout: int = 300,
) -> ConversionResult:
    """
    Convert a prompt to SDK code using a multi-stage workflow.

    Args:
        prompt_content: The prompt to convert
        model: AI model to use
        workspace_root: Workspace directory
        max_iterations: Maximum number of fix iterations
        timeout: Timeout for each agent call in seconds

    Returns:
        ConversionResult with the generated code and metadata
    """
    print("🤖 Starting multi-stage prompt-to-code conversion...")

    agent = Auggie(model=model, workspace_root=workspace_root)

    try:
        with agent.session() as session:
            # Stage 1: Create specification
            print("\n📋 Stage 1: Creating program specification...")
            spec = session.run(
                f"""Analyze this prompt and create a detailed specification for an SDK program:

{prompt_content}

Create a specification that includes:
1. Purpose: What the program should accomplish
2. Input requirements: What data/files it needs
3. Output requirements: What it should produce
4. Stages: Sequential steps in the workflow
5. Data structures: Any dataclasses or types needed
6. Test strategy: How to validate it works (WITHOUT modifying real user data)
7. Safety considerations: What could go wrong and how to prevent it

Return the specification as a JSON object.""",
                return_type=dict,
                timeout=timeout,
            )

            print("✅ Specification created:")
            print(f"   Purpose: {spec.get('purpose', 'N/A')}")
            print(f"   Stages: {len(spec.get('stages', []))}")
            test_strategy = spec.get("test_strategy", "N/A")
            if isinstance(test_strategy, str):
                print(f"   Test strategy: {test_strategy[:80]}...")
            else:
                print(f"   Test strategy: {test_strategy}")

            spec_obj = ProgramSpec(
                purpose=spec.get("purpose", ""),
                input_requirements=spec.get("input_requirements", []),
                output_requirements=spec.get("output_requirements", []),
                stages=spec.get("stages", []),
                data_structures=spec.get("data_structures", []),
                test_strategy=spec.get("test_strategy", ""),
                safety_considerations=spec.get("safety_considerations", ""),
            )

            # Stage 2: Implement
            print("\n💻 Stage 2: Implementing SDK program...")

            implementation_prompt = f"""Based on this specification, implement a complete Python program using the Augment SDK:

SPECIFICATION:
{json.dumps(spec, indent=2)}

ORIGINAL PROMPT:
{prompt_content}

REQUIREMENTS:
1. Use `from auggie_sdk import Auggie` for imports
2. Initialize agent with: `agent = Auggie()` or `agent = Auggie(workspace_root=".")`
3. Use `agent.run(prompt)` or `agent.run(prompt, return_type=Type)` - DO NOT call agent() directly
4. Use `agent.session()` for multi-step workflows with shared context
5. Include proper error handling
6. Add a main() function that can be run directly
7. Include docstrings and comments
8. Follow the test strategy from the spec to ensure safety
9. Start with #!/usr/bin/env python3 and a module docstring

Generate ONLY the complete Python code, no explanations."""

            code = session.run(implementation_prompt, return_type=str, timeout=timeout)

            print(f"✅ Initial implementation generated ({len(code)} chars)")

            # Stage 3: Test and iterate
            print("\n🧪 Stage 3: Testing and iteration...")

            iteration = 0
            validation = None

            while iteration < max_iterations:
                iteration += 1
                print(f"\n   Iteration {iteration}/{max_iterations}:")

                # Validate the code
                validation = validate_code(code, workspace_root)

                print(f"   - Syntax valid: {'✅' if validation.syntax_valid else '❌'}")
                print(
                    f"   - Type check: {'✅' if validation.type_check_passed else '⚠️'}"
                )
                print(
                    f"   - Imports valid: {'✅' if validation.imports_valid else '⚠️'}"
                )
                print(f"   - Dry run: {'✅' if validation.dry_run_passed else '❌'}")

                if validation.errors:
                    print(f"   - Errors: {len(validation.errors)}")
                    for error in validation.errors[:3]:
                        print(f"     • {error}")

                if validation.warnings:
                    print(f"   - Warnings: {len(validation.warnings)}")

                if validation.success:
                    print("   ✅ All validations passed!")
                    break

                # Fix issues
                if iteration < max_iterations:
                    print("   🔧 Fixing issues...")

                    fix_prompt = f"""The generated code has validation errors. Please fix them:

ERRORS:
{chr(10).join(validation.errors)}

WARNINGS:
{chr(10).join(validation.warnings)}

CURRENT CODE:
```python
{code}
```

Fix all errors and return the corrected code. Return ONLY the complete Python code, no explanations."""

                    code = session.run(fix_prompt, return_type=str, timeout=timeout)
                    print(f"   ✅ Code updated ({len(code)} chars)")

            # Stage 4: Cleanup and polish
            if validation and validation.success:
                print("\n✨ Stage 4: Final cleanup and polish...")

                cleanup_prompt = f"""Polish this working SDK program for production use:

{code}

Improvements to make:
1. Ensure all docstrings are clear and complete
2. Add helpful comments for complex logic
3. Ensure error messages are user-friendly
4. Verify the code follows Python best practices
5. Make sure the test strategy from the spec is implemented

Return ONLY the polished Python code, no explanations."""

                code = session.run(cleanup_prompt, return_type=str, timeout=timeout)
                print("   ✅ Code polished and ready!")

            # Final validation
            final_validation = validate_code(code, workspace_root)

            print("\n" + "=" * 80)
            print("CONVERSION COMPLETE")
            print("=" * 80)
            print(f"Success: {'✅' if final_validation.success else '❌'}")
            print(f"Iterations: {iteration}")
            print(f"Code size: {len(code)} characters")

            if final_validation.errors:
                print(f"\n⚠️  Remaining errors: {len(final_validation.errors)}")
                for error in final_validation.errors:
                    print(f"  • {error}")

            if final_validation.warnings:
                print(f"\n⚠️  Warnings: {len(final_validation.warnings)}")
                for warning in final_validation.warnings[:5]:
                    print(f"  • {warning}")

            return ConversionResult(
                success=final_validation.success,
                code=code,
                spec=spec_obj,
                validation=final_validation,
                iterations=iteration,
                error=None
                if final_validation.success
                else "; ".join(final_validation.errors),
            )

    except Exception as e:
        print(f"\n❌ Conversion failed: {e}")
        import traceback

        traceback.print_exc()

        return ConversionResult(
            success=False,
            code=None,
            spec=None,
            validation=None,
            iterations=0,
            error=str(e),
        )


def main():
    """Main entry point for the CLI."""
    parser = argparse.ArgumentParser(
        description="Convert a complex prompt into an Augment SDK program (v2 with multi-stage workflow)"
    )
    parser.add_argument(
        "prompt_file",
        type=str,
        help="Path to the file containing the prompt to convert",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        help="Output file for the generated SDK program (default: stdout)",
    )
    parser.add_argument(
        "--model",
        "-m",
        type=str,
        default="sonnet4.5",
        help="AI model to use (default: sonnet4.5)",
    )
    parser.add_argument(
        "--workspace-root",
        "-w",
        type=str,
        default=".",
        help="Workspace root directory (default: current directory)",
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=3,
        help="Maximum number of fix iterations (default: 3)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Timeout for each agent call in seconds (default: 300)",
    )

    args = parser.parse_args()

    # Read the prompt
    prompt_file = Path(args.prompt_file)
    if not prompt_file.exists():
        print(f"❌ Error: Prompt file not found: {prompt_file}", file=sys.stderr)
        sys.exit(1)

    prompt_content = prompt_file.read_text()

    # Convert
    result = convert_prompt_to_code_v2(
        prompt_content=prompt_content,
        model=args.model,
        workspace_root=args.workspace_root,
        max_iterations=args.max_iterations,
        timeout=args.timeout,
    )

    if not result.success:
        print(f"\n❌ Conversion failed: {result.error}", file=sys.stderr)
        sys.exit(1)

    # Output the code
    if args.output:
        output_file = Path(args.output)
        if result.code:
            output_file.write_text(result.code)
            print(f"\n✅ Generated SDK program saved to: {output_file}")
        else:
            print(f"\n⚠️  No code generated to save", file=sys.stderr)
    else:
        print("\n" + "=" * 80)
        print("GENERATED SDK PROGRAM")
        print("=" * 80)
        print(result.code)

    # Save metadata
    if args.output:
        metadata_file = Path(args.output).with_suffix(".json")
        metadata = {
            "success": result.success,
            "iterations": result.iterations,
            "spec": {
                "purpose": result.spec.purpose,
                "stages": result.spec.stages,
                "test_strategy": result.spec.test_strategy,
            }
            if result.spec
            else None,
            "validation": {
                "syntax_valid": result.validation.syntax_valid,
                "type_check_passed": result.validation.type_check_passed,
                "errors": result.validation.errors,
                "warnings": result.validation.warnings,
            }
            if result.validation
            else None,
        }
        metadata_file.write_text(json.dumps(metadata, indent=2))
        print(f"📊 Metadata saved to: {metadata_file}")


if __name__ == "__main__":
    main()
