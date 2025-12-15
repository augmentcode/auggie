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
import { tool } from "ai";
import { z } from "zod";
// Define schemas for tool inputs
const searchSchema = z.object({
    query: z.string().describe("Natural language search query describing what you're looking for"),
    maxChars: z.number().optional().describe("Maximum characters in response"),
});
const listFilesSchema = z.object({
    pattern: z.string().optional().describe("Glob pattern to filter files (e.g., '**/*.ts', 'src/**')"),
});
const readFileSchema = z.object({
    path: z.string().describe("Path to the file to read"),
});
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
export function createAISDKTools(config) {
    const { client } = config;
    const hasSource = client.hasSource();
    const meta = client.getMetadata();
    const searchTool = tool({
        description: `Search the codebase (${meta.type}://${meta.identifier}) using natural language. Returns relevant code snippets and file paths.`,
        inputSchema: searchSchema,
        execute: async ({ query, maxChars }) => {
            const result = await client.search(query, { maxOutputLength: maxChars });
            return result.results || "No results found.";
        },
    });
    // Only add file tools if source is available
    if (hasSource) {
        const listFilesTool = tool({
            description: "List all files in the codebase. Optionally filter by glob pattern.",
            inputSchema: listFilesSchema,
            execute: async ({ pattern }) => {
                const files = await client.listFiles({ pattern });
                return files.map(f => f.path).join("\n");
            },
        });
        const readFileTool = tool({
            description: "Read the contents of a specific file from the codebase.",
            inputSchema: readFileSchema,
            execute: async ({ path }) => {
                const result = await client.readFile(path);
                if (result.error) {
                    return `Error: ${result.error}`;
                }
                return result.contents ?? "";
            },
        });
        return {
            search: searchTool,
            listFiles: listFilesTool,
            readFile: readFileTool,
        };
    }
    return {
        search: searchTool,
    };
}
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
export function createLazyAISDKTools(initClient) {
    let client = null;
    let initPromise = null;
    const getClient = async () => {
        if (client)
            return client;
        if (!initPromise) {
            initPromise = initClient().then(c => {
                client = c;
                return c;
            });
        }
        return initPromise;
    };
    return {
        search: tool({
            description: "Search the codebase using natural language.",
            inputSchema: searchSchema,
            execute: async ({ query, maxChars }) => {
                const c = await getClient();
                const result = await c.search(query, { maxOutputLength: maxChars });
                return result.results || "No results found.";
            },
        }),
        listFiles: tool({
            description: "List files in the codebase.",
            inputSchema: listFilesSchema,
            execute: async ({ pattern }) => {
                const c = await getClient();
                const files = await c.listFiles({ pattern });
                return files.map(f => f.path).join("\n");
            },
        }),
        readFile: tool({
            description: "Read a file from the codebase.",
            inputSchema: readFileSchema,
            execute: async ({ path }) => {
                const c = await getClient();
                const result = await c.readFile(path);
                return result.error ? `Error: ${result.error}` : result.contents ?? "";
            },
        }),
    };
}
//# sourceMappingURL=ai-sdk-tools.js.map