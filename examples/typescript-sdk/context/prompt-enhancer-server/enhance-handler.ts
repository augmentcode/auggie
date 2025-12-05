import type { FileSystemContext } from "@augmentcode/auggie-sdk";
import { parseEnhancedPrompt } from "./response-parser";

export type EnhanceResponse = {
  original: string;
  enhanced: string;
};

/**
 * Handle prompt enhancement request using searchAndAsk
 *
 * Uses the FileSystemContext to search for relevant code and enhance the prompt
 * with codebase context.
 */
export async function handleEnhance(
  prompt: string,
  context: FileSystemContext
): Promise<EnhanceResponse> {
  console.log(`\n[${new Date().toISOString()}] Enhancing prompt: "${prompt}"`);

  // Build the enhancement instruction
  const enhancementPrompt =
    "Here is an instruction that I'd like to give you, but it needs to be improved. " +
    "Rewrite and enhance this instruction to make it clearer, more specific, " +
    "less ambiguous, and correct any mistakes. " +
    "If there is code in triple backticks (```) consider whether it is a code sample and should remain unchanged. " +
    "Reply with the following format:\n\n" +
    "### BEGIN RESPONSE ###\n" +
    "Here is an enhanced version of the original instruction that is more specific and clear:\n" +
    "<enhanced-prompt>enhanced prompt goes here</enhanced-prompt>\n\n" +
    "### END RESPONSE ###\n\n" +
    "Here is my original instruction:\n\n" +
    prompt;

  // Use searchAndAsk to get the enhancement with relevant codebase context
  // The original prompt is used as the search query to find relevant code
  const response = await context.searchAndAsk(prompt, enhancementPrompt);

  // Parse the enhanced prompt from the response
  const enhanced = parseEnhancedPrompt(response);
  if (!enhanced) {
    throw new Error("Failed to parse enhanced prompt from response");
  }

  return {
    original: prompt,
    enhanced,
  };
}
