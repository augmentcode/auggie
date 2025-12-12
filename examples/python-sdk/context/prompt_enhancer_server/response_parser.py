"""Response parser for extracting enhanced prompts from AI responses"""

import re

# Regex for extracting enhanced prompt from AI response
ENHANCED_PROMPT_REGEX = re.compile(r"<enhanced-prompt>(.*?)</enhanced-prompt>", re.DOTALL)


def parse_enhanced_prompt(response: str) -> str | None:
    """
    Parse the enhanced prompt from the AI response

    Args:
        response: The AI response containing the enhanced prompt

    Returns:
        The enhanced prompt text, or None if not found
    """
    # Extract content between <enhanced-prompt> tags
    match = ENHANCED_PROMPT_REGEX.search(response)

    if match and match.group(1):
        return match.group(1).strip()

    return None

