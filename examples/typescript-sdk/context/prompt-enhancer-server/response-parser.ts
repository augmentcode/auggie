// Regex for extracting enhanced prompt from AI response
const ENHANCED_PROMPT_REGEX =
  /<enhanced-prompt>([\s\S]*?)<\/enhanced-prompt>/;

/**
 * Parse the enhanced prompt from the AI response
 */
export function parseEnhancedPrompt(response: string): string | null {
  // Extract content between <augment-enhanced-prompt> tags
  const match = response.match(ENHANCED_PROMPT_REGEX);

  if (match?.[1]) {
    return match[1].trim();
  }

  return null;
}
