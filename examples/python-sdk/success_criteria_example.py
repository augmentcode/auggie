#!/usr/bin/env python3
"""
Example demonstrating success_criteria parameter.

This shows how to use success criteria to ensure the agent iteratively
works on a task and verifies criteria until all are met.

The agent will:
1. Work on the task
2. Verify success criteria
3. If not all met, fix issues and repeat
4. Continue until all criteria are met or max rounds reached
5. If criteria not met after max rounds, raises AugmentVerificationError
"""

from auggie_sdk import Agent, AugmentVerificationError


def main():
    """Demonstrate success criteria usage."""

    agent = Auggie()

    print("🎯 Success Criteria Example")
    print("=" * 60)

    # Example 1: Create a file with specific requirements
    print("\n1. Creating a file with success criteria:")
    print("   Task: Create a Python function")
    print("   Criteria:")
    print("   - Function must have type hints")
    print("   - Function must have a docstring")
    print("   - Function must have error handling")

    agent.run(
        "Create a Python function called 'divide_numbers' that divides two numbers",
        success_criteria=[
            "The function has type hints for all parameters and return value",
            "The function has a comprehensive docstring",
            "The function handles division by zero with proper error handling",
        ],
    )
    print("   ✅ Function created and verified!")

    # Example 2: Code refactoring with quality checks
    print("\n2. Refactoring with quality criteria:")
    print("   Task: Refactor a function")
    print("   Criteria:")
    print("   - Code follows PEP 8 style guidelines")
    print("   - No code duplication")
    print("   - All edge cases are handled")

    agent.run(
        "Refactor the divide_numbers function to be more robust",
        success_criteria=[
            "Code follows PEP 8 style guidelines",
            "No code duplication exists",
            "All edge cases (zero, negative numbers, type errors) are handled",
        ],
    )
    print("   ✅ Refactoring completed and verified!")

    # Example 3: Documentation with completeness checks
    print("\n3. Documentation with completeness criteria:")

    agent.run(
        "Add comprehensive documentation to the divide_numbers function",
        success_criteria=[
            "Docstring includes parameter descriptions",
            "Docstring includes return value description",
            "Docstring includes examples of usage",
            "Docstring includes information about exceptions that can be raised",
        ],
    )
    print("   ✅ Documentation added and verified!")

    # Example 4: Demonstrating iterative verification with max_verification_rounds
    print("\n4. Iterative verification with custom max rounds:")
    print("   Task: Create a complex function")
    print("   Max verification rounds: 5")

    agent.run(
        "Create a Python function called 'process_data' that validates and transforms input data",
        success_criteria=[
            "Function has complete type hints",
            "Function has comprehensive docstring with examples",
            "Function handles all edge cases (None, empty, invalid types)",
            "Function includes input validation with clear error messages",
            "Code follows PEP 8 and has no duplication",
        ],
        max_verification_rounds=5,  # Allow up to 5 rounds of verification
    )
    print("   ✅ Complex function created with iterative verification!")

    # Example 5: Exception handling when criteria not met
    print("\n5. Exception handling for unmet criteria:")
    print("   Task: Intentionally difficult task with strict criteria")

    try:
        agent.run(
            "Create a simple hello world function",
            success_criteria=[
                "Function has type hints",
                "Function has docstring",
                # This criterion is intentionally impossible to demonstrate exception
                "Function must be written in a language that doesn't exist",
            ],
            max_verification_rounds=2,  # Low max to trigger exception faster
        )
    except AugmentVerificationError as e:
        print(f"   ⚠️  Verification failed after {e.rounds_attempted} rounds")
        print(f"   Unmet criteria: {e.unmet_criteria}")
        print(f"   Issues: {e.issues[:1]}...")  # Show first issue
        print("   ✅ Exception handling works correctly!")

    print("\n" + "=" * 60)
    print("✨ All examples completed with success criteria verification!")
    print("\nKey benefits of success_criteria:")
    print("  • Ensures quality standards are met")
    print("  • Agent iteratively verifies and fixes issues")
    print("  • Reduces need for manual review")
    print("  • Catches common mistakes automatically")
    print("  • Provides structured feedback on what needs fixing")
    print("  • Raises exception if criteria cannot be met")
    print("\nHow it works:")
    print("  1. Agent works on the task")
    print("  2. Agent verifies all success criteria")
    print("  3. If not all met, agent receives specific feedback")
    print("  4. Agent fixes the identified issues")
    print("  5. Repeat until all criteria met or max rounds reached")
    print("  6. If max rounds exceeded, raises AugmentVerificationError")


if __name__ == "__main__":
    main()
