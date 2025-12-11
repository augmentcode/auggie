"""Search handler for file search server"""

from typing import TypedDict

from auggie_sdk.context import FileSystemContext


class SearchResponse(TypedDict):
    """Response type for search requests"""

    query: str
    summary: str
    formattedResults: str


def handle_search(query: str, context: FileSystemContext) -> SearchResponse:
    """
    Handle search request

    Args:
        query: Search query string
        context: FileSystemContext instance

    Returns:
        SearchResponse with query, summary, and formatted results
    """
    # Search for relevant code - returns formatted string ready for LLM use
    formatted_results = context.search(query)

    if not formatted_results or formatted_results.strip() == "":
        return {
            "query": query,
            "summary": "No relevant results found.",
            "formattedResults": "",
        }

    # Use search_and_ask to summarize the relevant results
    summary = context.search_and_ask(
        query,
        f'Provide a concise summary of the relevant results for the query "{query}". Focus only on the most relevant information.',
    )

    return {
        "query": query,
        "summary": summary,
        "formattedResults": formatted_results,
    }

