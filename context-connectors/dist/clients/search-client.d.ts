/**
 * SearchClient - Client for searching indexed content.
 *
 * The SearchClient provides a high-level API for:
 * - Semantic search across indexed content
 * - File listing (when Source is provided)
 * - File reading (when Source is provided)
 *
 * @module clients/search-client
 *
 * @example
 * ```typescript
 * import { SearchClient } from "@augmentcode/context-connectors";
 * import { FilesystemStore } from "@augmentcode/context-connectors/stores";
 * import { FilesystemSource } from "@augmentcode/context-connectors/sources";
 *
 * // Search-only mode (no file operations)
 * const client = new SearchClient({
 *   store: new FilesystemStore(),
 *   key: "my-project",
 * });
 * await client.initialize();
 * const results = await client.search("authentication");
 *
 * // Full mode (with file operations)
 * const fullClient = new SearchClient({
 *   store: new FilesystemStore(),
 *   source: new FilesystemSource({ rootPath: "./my-project" }),
 *   key: "my-project",
 * });
 * await fullClient.initialize();
 * const files = await fullClient.listFiles({ pattern: "**\/*.ts" });
 * ```
 */
import type { IndexStoreReader } from "../stores/types.js";
import type { Source } from "../sources/types.js";
import type { SearchOptions } from "../tools/types.js";
/**
 * Configuration for SearchClient.
 */
export interface SearchClientConfig {
    /** Store to load index from (read-only access sufficient) */
    store: IndexStoreReader;
    /**
     * Optional source for file operations.
     * When provided, enables listFiles() and readFile() methods.
     * When omitted, client operates in search-only mode.
     */
    source?: Source;
    /** Index key/name to load */
    key: string;
    /**
     * Augment API key.
     * @default process.env.AUGMENT_API_TOKEN
     */
    apiKey?: string;
    /**
     * Augment API URL.
     * @default process.env.AUGMENT_API_URL
     */
    apiUrl?: string;
}
/**
 * Client for searching indexed content and accessing source files.
 *
 * The SearchClient operates in two modes:
 *
 * **Search-only mode** (no Source provided):
 * - `search()` works
 * - `listFiles()` and `readFile()` throw errors
 *
 * **Full mode** (Source provided):
 * - All methods work
 * - Source type must match the stored index
 *
 * @example
 * ```typescript
 * const client = new SearchClient({
 *   store: new FilesystemStore(),
 *   source: new FilesystemSource({ rootPath: "." }),
 *   key: "my-project",
 * });
 *
 * await client.initialize();
 *
 * // Search
 * const { results } = await client.search("database connection");
 *
 * // List files
 * if (client.hasSource()) {
 *   const files = await client.listFiles({ pattern: "**\/*.sql" });
 * }
 * ```
 */
export declare class SearchClient {
    private store;
    private source;
    private key;
    private apiKey;
    private apiUrl;
    private context;
    private state;
    /**
     * Create a new SearchClient.
     *
     * Note: You must call `initialize()` before using the client.
     *
     * @param config - Client configuration
     */
    constructor(config: SearchClientConfig);
    /**
     * Initialize the client by loading the index from the store.
     *
     * Must be called before using any other methods.
     * Validates that the provided Source matches the stored index type.
     *
     * @throws Error if index not found or Source type mismatch
     *
     * @example
     * ```typescript
     * const client = new SearchClient({ store, key: "my-project" });
     * await client.initialize(); // Required!
     * const results = await client.search("query");
     * ```
     */
    initialize(): Promise<void>;
    private getToolContext;
    /**
     * Search the indexed content using natural language.
     *
     * @param query - Natural language search query
     * @param options - Optional search options
     * @returns Search results with matching code snippets
     *
     * @example
     * ```typescript
     * const { results } = await client.search("user authentication", {
     *   maxOutputLength: 5000,
     * });
     * console.log(results);
     * ```
     */
    search(query: string, options?: SearchOptions): Promise<import("../tools/search.js").SearchResult>;
    /**
     * List files in the source.
     *
     * Requires a Source to be configured (full mode).
     *
     * @param options - Optional filter options
     * @returns Array of file info objects
     * @throws Error if no Source is configured
     *
     * @example
     * ```typescript
     * const files = await client.listFiles({ pattern: "src/**\/*.ts" });
     * console.log(`Found ${files.length} TypeScript files`);
     * ```
     */
    listFiles(options?: {
        pattern?: string;
    }): Promise<import("../core/types.js").FileInfo[]>;
    /**
     * Read a file from the source.
     *
     * Requires a Source to be configured (full mode).
     *
     * @param path - Relative path to the file
     * @returns File contents or error
     * @throws Error if no Source is configured
     *
     * @example
     * ```typescript
     * const result = await client.readFile("src/index.ts");
     * if (result.contents) {
     *   console.log(result.contents);
     * } else {
     *   console.error(result.error);
     * }
     * ```
     */
    readFile(path: string): Promise<import("../tools/read-file.js").ReadFileResult>;
    /**
     * Get metadata about the indexed source.
     *
     * @returns Source metadata (type, identifier, ref, syncedAt)
     * @throws Error if client not initialized
     */
    getMetadata(): import("../core/types.js").SourceMetadata;
    /**
     * Check if a Source is available for file operations.
     *
     * @returns true if listFiles/readFile are available
     */
    hasSource(): boolean;
}
//# sourceMappingURL=search-client.d.ts.map