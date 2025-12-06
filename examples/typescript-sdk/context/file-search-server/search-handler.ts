import type { FileSystemContext } from "@augmentcode/auggie-sdk";

export type SearchResponse = {
  query: string;
  summary: string;
  formattedResults: string;
};

/**
 * Handle search request
 */
export async function handleSearch(
  query: string,
  context: FileSystemContext
): Promise<SearchResponse> {
  // Search for relevant code - returns formatted string ready for LLM use
  const formattedResults = await context.search(query);

  if (!formattedResults || formattedResults.trim().length === 0) {
    return {
      query,
      summary: "No relevant results found.",
      formattedResults: "",
    };
  }

  // Use searchAndAsk to summarize the relevant results
  const summary = await context.searchAndAsk(
    query,
    `Provide a concise summary of the relevant results for the query "${query}". Focus only on the most relevant information.`
  );

  return {
    query,
    summary,
    formattedResults,
  };
}
