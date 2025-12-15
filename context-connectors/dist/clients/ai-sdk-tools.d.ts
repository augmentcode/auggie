/**
 * AI SDK compatible tools for SearchClient.
 *
 * Provides tool factories that work with Vercel's AI SDK:
 * - `generateText()` / `streamText()`
 * - Agent loops with `maxSteps`
 *
 * @module clients/ai-sdk-tools
 *
 * @example
 * ```typescript
 * import { generateText } from "ai";
 * import { openai } from "@ai-sdk/openai";
 * import { createAISDKTools } from "@augmentcode/context-connectors";
 *
 * const tools = createAISDKTools({ client });
 *
 * const result = await generateText({
 *   model: openai("gpt-4o"),
 *   tools,
 *   maxSteps: 5,
 *   prompt: "Find the authentication logic",
 * });
 * ```
 */
import type { SearchClient } from "./search-client.js";
/**
 * Configuration for creating AI SDK tools.
 */
export interface AISDKToolsConfig {
    /** Initialized SearchClient instance */
    client: SearchClient;
}
/**
 * Create AI SDK compatible tools from a SearchClient.
 *
 * Returns an object containing tool definitions that can be passed
 * directly to AI SDK's `generateText()`, `streamText()`, or agent loops.
 *
 * The returned tools depend on whether the SearchClient has a Source:
 * - **With Source**: `search`, `listFiles`, `readFile`
 * - **Without Source**: `search` only
 *
 * @param config - Configuration with initialized SearchClient
 * @returns Object containing AI SDK tool definitions
 *
 * @example
 * ```typescript
 * const client = new SearchClient({ store, source, key: "my-project" });
 * await client.initialize();
 *
 * const tools = createAISDKTools({ client });
 * // tools.search is always available
 * // tools.listFiles and tools.readFile available if hasSource()
 *
 * const result = await generateText({
 *   model: openai("gpt-4o"),
 *   tools,
 *   maxSteps: 5,
 *   prompt: "What does this project do?",
 * });
 * ```
 */
export declare function createAISDKTools(config: AISDKToolsConfig): {
    search: import("ai").Tool<{
        query: string;
        maxChars?: number | undefined;
    }, string>;
    listFiles: import("ai").Tool<{
        pattern?: string | undefined;
    }, string>;
    readFile: import("ai").Tool<{
        path: string;
    }, string>;
} | {
    search: import("ai").Tool<{
        query: string;
        maxChars?: number | undefined;
    }, string>;
    listFiles?: undefined;
    readFile?: undefined;
};
/**
 * Create AI SDK tools with lazy initialization.
 *
 * Defers SearchClient initialization until the first tool is called.
 * Useful for:
 * - Serverless environments (avoid cold start delays)
 * - Conditional tool usage (don't initialize if tools not needed)
 *
 * The client is initialized once on first use and then reused.
 *
 * Note: With lazy initialization, all three tools (search, listFiles, readFile)
 * are always returned. If the client doesn't have a source, listFiles and
 * readFile will error when called.
 *
 * @param initClient - Async function that creates and initializes a SearchClient
 * @returns Object containing AI SDK tool definitions
 *
 * @example
 * ```typescript
 * const tools = createLazyAISDKTools(async () => {
 *   const store = new FilesystemStore();
 *   const client = new SearchClient({ store, key: "my-project" });
 *   await client.initialize();
 *   return client;
 * });
 *
 * // Client not initialized yet
 *
 * const result = await generateText({
 *   model: openai("gpt-4o"),
 *   tools,
 *   prompt: "Find auth logic", // Client initializes here
 * });
 * ```
 */
export declare function createLazyAISDKTools(initClient: () => Promise<SearchClient>): {
    search: import("ai").Tool<{
        query: string;
        maxChars?: number | undefined;
    }, string>;
    listFiles: import("ai").Tool<{
        pattern?: string | undefined;
    }, string>;
    readFile: import("ai").Tool<{
        path: string;
    }, string>;
};
//# sourceMappingURL=ai-sdk-tools.d.ts.map