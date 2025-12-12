"""Enhance handler for prompt enhancement requests"""

from datetime import datetime
from typing import TypedDict

from auggie_sdk.context import FileSystemContext
from response_parser import parse_enhanced_prompt


class EnhanceResponse(TypedDict):
    """Response type for enhance requests"""

    original: str
    enhanced: str


def handle_enhance(prompt: str, context: FileSystemContext) -> EnhanceResponse:
    """
    Handle prompt enhancement request using search_and_ask

    Uses the FileSystemContext to search for relevant code and enhance the prompt
    with codebase context.

    Args:
        prompt: The original prompt to enhance
        context: FileSystemContext instance

    Returns:
        EnhanceResponse with original and enhanced prompts
    """
    print(f"\n[{datetime.now().isoformat()}] Enhancing prompt: \"{prompt}\"")

    # Build the enhancement instruction
    enhancement_prompt = (
        "Here is an instruction that I'd like to give you, but it needs to be improved. "
        "Rewrite and enhance this instruction to make it clearer, more specific, "
        "less ambiguous, and correct any mistakes. "
        "If there is code in triple backticks (```) consider whether it is a code sample and should remain unchanged. "
        "Reply with the following format:\n\n"
        "### BEGIN RESPONSE ###\n"
        "Here is an enhanced version of the original instruction that is more specific and clear:\n"
        "<enhanced-prompt>enhanced prompt goes here</enhanced-prompt>\n\n"
        "### END RESPONSE ###\n\n"
        "Here is my original instruction:\n\n"
        f"{prompt}"
    )

    # Use search_and_ask to get the enhancement with relevant codebase context
    # The original prompt is used as the search query to find relevant code
    response = context.search_and_ask(prompt, enhancement_prompt)

    # Parse the enhanced prompt from the response
    enhanced = parse_enhanced_prompt(response)
    if not enhanced:
        raise ValueError("Failed to parse enhanced prompt from response")

    return {
        "original": prompt,
        "enhanced": enhanced,
    }

