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
 * import { GitHubSource } from "@augmentcode/context-connectors/sources";
 *
 * // Search-only mode (no file operations)
 * const client = new SearchClient({
 *   store: new FilesystemStore(),
 *   indexName: "my-project",
 * });
 * await client.initialize();
 * const results = await client.search("authentication");
 *
 * // Full mode (with file operations)
 * const fullClient = new SearchClient({
 *   store: new FilesystemStore(),
 *   source: new GitHubSource({ owner: "my-org", repo: "my-project" }),
 *   indexName: "my-project",
 * });
 * await fullClient.initialize();
 * const files = await fullClient.listFiles({ pattern: "**\/*.ts" });
 * ```
 */

import { DirectContext } from "@augmentcode/auggie-sdk";
import type { IndexStoreReader } from "../stores/types.js";
import type { Source } from "../sources/types.js";
import type { IndexState, IndexStateSearchOnly } from "../core/types.js";
import type { ToolContext, SearchOptions } from "../tools/types.js";
import type { ListFilesOptions } from "../tools/list-files.js";
import type { ReadFileOptions } from "../tools/read-file.js";
import { search, listFiles, readFile } from "../tools/index.js";

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
  /** Index name to load */
  indexName: string;
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
 *   source: new GitHubSource({ owner: "my-org", repo: "my-project" }),
 *   indexName: "my-project",
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
export class SearchClient {
  private store: IndexStoreReader;
  private source: Source | null;
  private indexName: string;
  private apiKey: string;
  private apiUrl: string;

  private context: DirectContext | null = null;
  private state: IndexStateSearchOnly | null = null;

  /**
   * Create a new SearchClient.
   *
   * Note: You must call `initialize()` before using the client.
   *
   * @param config - Client configuration
   */
  constructor(config: SearchClientConfig) {
    this.store = config.store;
    this.source = config.source ?? null;
    this.indexName = config.indexName;
    this.apiKey = config.apiKey ?? process.env.AUGMENT_API_TOKEN ?? "";
    this.apiUrl = config.apiUrl ?? process.env.AUGMENT_API_URL ?? "";
  }

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
   * const client = new SearchClient({ store, indexName: "my-project" });
   * await client.initialize(); // Required!
   * const results = await client.search("query");
   * ```
   */
  async initialize(): Promise<void> {
    // Load search-optimized state (much smaller, no blobs array)
    this.state = await this.store.loadSearch(this.indexName);
    if (!this.state) {
      throw new Error(`Index "${this.indexName}" not found`);
    }

    // Validate source matches if provided
    if (this.source) {
      const sourceMeta = await this.source.getMetadata();
      if (sourceMeta.type !== this.state.source.type) {
        throw new Error(
          `Source type mismatch: expected ${this.state.source.type}, got ${sourceMeta.type}`
        );
      }
      // Note: identifier check could be relaxed (paths may differ slightly)
    }

    // Import DirectContext from saved state
    this.context = await DirectContext.import(this.state.contextState, {
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
    });
  }

  private getToolContext(): ToolContext {
    if (!this.context || !this.state) {
      throw new Error("Client not initialized. Call initialize() first.");
    }
    return { context: this.context, source: this.source, state: this.state };
  }

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
  async search(query: string, options?: SearchOptions) {
    return search(this.getToolContext(), query, options);
  }

  /**
   * Search the indexed content and ask a question about the results.
   *
   * Uses an LLM to answer the question based on the search results.
   *
   * @param query - Search query to find relevant content
   * @param question - Question to ask about the search results
   * @returns Answer from the LLM based on the search results
   *
   * @example
   * ```typescript
   * const answer = await client.searchAndAsk(
   *   "user authentication",
   *   "How does the login flow work?"
   * );
   * console.log(answer);
   * ```
   */
  async searchAndAsk(query: string, question: string): Promise<string> {
    if (!this.context) {
      throw new Error("Client not initialized. Call initialize() first.");
    }
    return this.context.searchAndAsk(query, question);
  }

  /**
   * List files and directories in the source.
   *
   * Requires a Source to be configured (full mode).
   * By default, lists up to 2 levels deep (like Auggie CLI).
   *
   * @param options - Optional filter and depth options
   * @returns Array of file/directory info objects with paths and types
   * @throws Error if no Source is configured
   *
   * @example
   * ```typescript
   * // List with default depth (2 levels)
   * const files = await client.listFiles();
   *
   * // List only immediate children
   * const shallow = await client.listFiles({ depth: 1 });
   *
   * // List with pattern filter
   * const tsFiles = await client.listFiles({ directory: "src", pattern: "*.ts" });
   * ```
   */
  async listFiles(options?: ListFilesOptions) {
    return listFiles(this.getToolContext(), options);
  }

  /**
   * Read a file from the source.
   *
   * Requires a Source to be configured (full mode).
   * Returns formatted output with line numbers by default.
   *
   * @param path - Relative path to the file
   * @param options - Optional reading options (range, search, formatting)
   * @returns File contents with formatting, or error
   * @throws Error if no Source is configured
   *
   * @example
   * ```typescript
   * // Read entire file with line numbers
   * const result = await client.readFile("src/index.ts");
   *
   * // Read specific range
   * const result = await client.readFile("src/index.ts", {
   *   startLine: 10,
   *   endLine: 50,
   * });
   *
   * // Search within file
   * const result = await client.readFile("src/index.ts", {
   *   searchPattern: "export.*function",
   * });
   * ```
   */
  async readFile(path: string, options?: ReadFileOptions) {
    return readFile(this.getToolContext(), path, options);
  }

  /**
   * Get metadata about the indexed source.
   *
   * @returns Source metadata (type, identifier, ref, syncedAt)
   * @throws Error if client not initialized
   */
  getMetadata() {
    if (!this.state) throw new Error("Client not initialized");
    return this.state.source;
  }

  /**
   * Check if a Source is available for file operations.
   *
   * @returns true if listFiles/readFile are available
   */
  hasSource(): boolean {
    return this.source !== null;
  }
}

