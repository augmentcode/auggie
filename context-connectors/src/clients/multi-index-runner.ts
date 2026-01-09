/**
 * MultiIndexRunner - Shared tool execution logic for multi-index scenarios.
 *
 * Used by both MCP server and CLI agent to provide search/listFiles/readFile
 * across multiple indexes with lazy client initialization.
 *
 * @module clients/multi-index-runner
 */

import type { IndexStoreReader } from "../stores/types.js";
import type { Source } from "../sources/types.js";
import type { IndexStateSearchOnly } from "../core/types.js";
import { getSourceIdentifier, getResolvedRef } from "../core/types.js";
import { SearchClient } from "./search-client.js";
import { formatListOutput } from "../tools/list-files.js";

/** Metadata about an available index */
export interface IndexInfo {
  name: string;
  type: string;
  identifier: string;
  ref?: string;
  syncedAt: string;
}

/** Configuration for MultiIndexRunner */
export interface MultiIndexRunnerConfig {
  /** Store to load indexes from */
  store: IndexStoreReader;
  /**
   * Index names to expose. If undefined, all indexes in the store are exposed.
   */
  indexNames?: string[];
  /**
   * Disable file operations (listFiles, readFile).
   * When true, only search is available.
   */
  searchOnly?: boolean;
}

/** Create a Source from index state metadata */
async function createSourceFromState(state: IndexStateSearchOnly): Promise<Source> {
  const meta = state.source;
  if (meta.type === "github") {
    const { GitHubSource } = await import("../sources/github.js");
    return new GitHubSource(meta.config);
  } else if (meta.type === "gitlab") {
    const { GitLabSource } = await import("../sources/gitlab.js");
    return new GitLabSource(meta.config);
  } else if (meta.type === "bitbucket") {
    const { BitBucketSource } = await import("../sources/bitbucket.js");
    return new BitBucketSource(meta.config);
  } else if (meta.type === "website") {
    const { WebsiteSource } = await import("../sources/website.js");
    return new WebsiteSource(meta.config);
  }
  throw new Error(`Unknown source type: ${(meta as { type: string }).type}`);
}

/**
 * Manages multiple indexes and provides unified tool execution.
 *
 * Lazily initializes SearchClient instances as needed and caches them.
 */
export class MultiIndexRunner {
  private readonly store: IndexStoreReader;
  private readonly searchOnly: boolean;
  private readonly clientCache = new Map<string, SearchClient>();

  /** Available index names */
  readonly indexNames: string[];

  /** Metadata about available indexes */
  readonly indexes: IndexInfo[];

  private constructor(
    store: IndexStoreReader,
    indexNames: string[],
    indexes: IndexInfo[],
    searchOnly: boolean
  ) {
    this.store = store;
    this.indexNames = indexNames;
    this.indexes = indexes;
    this.searchOnly = searchOnly;
  }

  /**
   * Create a MultiIndexRunner from configuration.
   */
  static async create(config: MultiIndexRunnerConfig): Promise<MultiIndexRunner> {
    const store = config.store;
    const searchOnly = config.searchOnly ?? false;

    // Discover available indexes
    const allIndexNames = await store.list();
    const indexNames = config.indexNames ?? allIndexNames;

    // Validate requested indexes exist
    const missingIndexes = indexNames.filter((n) => !allIndexNames.includes(n));
    if (missingIndexes.length > 0) {
      throw new Error(`Indexes not found: ${missingIndexes.join(", ")}`);
    }

    if (indexNames.length === 0) {
      throw new Error("No indexes available in store");
    }

    // Load metadata for available indexes, filtering out any that fail to load
    const indexes: IndexInfo[] = [];
    const validIndexNames: string[] = [];
    for (const name of indexNames) {
      const state = await store.loadSearch(name);
      if (state) {
        validIndexNames.push(name);
        indexes.push({
          name,
          type: state.source.type,
          identifier: getSourceIdentifier(state.source),
          ref: getResolvedRef(state.source),
          syncedAt: state.source.syncedAt,
        });
      }
      // Skip indexes that fail to load (e.g., corrupted or partial state)
    }

    if (validIndexNames.length === 0) {
      throw new Error("No valid indexes available (all indexes failed to load)");
    }

    return new MultiIndexRunner(store, validIndexNames, indexes, searchOnly);
  }

  /**
   * Get or create a SearchClient for an index.
   */
  async getClient(indexName: string): Promise<SearchClient> {
    if (!this.indexNames.includes(indexName)) {
      throw new Error(
        `Invalid index_name "${indexName}". Available: ${this.indexNames.join(", ")}`
      );
    }

    let client = this.clientCache.get(indexName);
    if (!client) {
      const state = await this.store.loadSearch(indexName);
      if (!state) {
        throw new Error(`Index "${indexName}" not found`);
      }
      const source = this.searchOnly
        ? undefined
        : await createSourceFromState(state);
      client = new SearchClient({
        store: this.store,
        source,
        indexName,
      });
      await client.initialize();
      this.clientCache.set(indexName, client);
    }
    return client;
  }

  /** Check if file operations are enabled */
  hasFileOperations(): boolean {
    return !this.searchOnly;
  }

  /** Get formatted index list for tool descriptions */
  getIndexListString(): string {
    return this.indexes
      .map((i) => `- ${i.name} (${i.type}://${i.identifier})`)
      .join("\n");
  }
}

