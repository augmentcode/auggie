/**
 * S3 Store - Persists index state to S3-compatible object storage.
 *
 * Enables cloud-based index storage for:
 * - Sharing indexes across machines
 * - CI/CD pipelines (index in CI, use in production)
 * - Serverless deployments
 *
 * Supports:
 * - AWS S3
 * - MinIO
 * - Cloudflare R2
 * - DigitalOcean Spaces
 * - Any S3-compatible storage
 *
 * Requires @aws-sdk/client-s3 as a peer dependency.
 *
 * @module stores/s3
 *
 * @example
 * ```typescript
 * import { S3Store } from "@augmentcode/context-connectors/stores";
 *
 * // AWS S3
 * const awsStore = new S3Store({
 *   bucket: "my-indexes",
 *   prefix: "context-connectors/",
 *   region: "us-west-2",
 * });
 *
 * // MinIO or other S3-compatible
 * const minioStore = new S3Store({
 *   bucket: "indexes",
 *   endpoint: "http://localhost:9000",
 *   forcePathStyle: true,
 * });
 * ```
 */

import type { IndexState, IndexStateSearchOnly } from "../core/types.js";
import type { IndexStore } from "./types.js";
import { sanitizeKey } from "../core/utils.js";

/**
 * Configuration for S3Store.
 */
export interface S3StoreConfig {
  /** S3 bucket name */
  bucket: string;
  /**
   * Key prefix for all stored indexes.
   * @default "context-connectors/"
   */
  prefix?: string;
  /**
   * AWS region.
   * @default process.env.AWS_REGION or "us-east-1"
   */
  region?: string;
  /**
   * Custom endpoint URL for S3-compatible services.
   * Required for MinIO, R2, DigitalOcean Spaces, etc.
   */
  endpoint?: string;
  /**
   * Force path-style URLs instead of virtual-hosted-style.
   * Required for some S3-compatible services.
   * @default false
   */
  forcePathStyle?: boolean;
}

const DEFAULT_PREFIX = "context-connectors/";
const STATE_FILENAME = "state.json";
const SEARCH_FILENAME = "search.json";

/** Type for the S3 client (imported dynamically) */
type S3ClientType = import("@aws-sdk/client-s3").S3Client;
type GetObjectCommandType = typeof import("@aws-sdk/client-s3").GetObjectCommand;
type PutObjectCommandType = typeof import("@aws-sdk/client-s3").PutObjectCommand;
type DeleteObjectCommandType = typeof import("@aws-sdk/client-s3").DeleteObjectCommand;
type ListObjectsV2CommandType = typeof import("@aws-sdk/client-s3").ListObjectsV2Command;

/**
 * Store implementation that persists to S3-compatible object storage.
 *
 * Creates an object structure:
 * ```
 * {prefix}{key}/
 *   state.json     - Full state (for incremental builds)
 *   search.json    - Search index (same content for now, placeholder for future)
 * ```
 *
 * @example
 * ```typescript
 * const store = new S3Store({ bucket: "my-indexes" });
 *
 * // Check if index exists
 * if (await store.exists("my-project")) {
 *   const { state, contextData } = await store.load("my-project");
 * }
 * ```
 */
export class S3Store implements IndexStore {
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly forcePathStyle: boolean;
  private client: S3ClientType | null = null;
  private commands: {
    GetObjectCommand: GetObjectCommandType;
    PutObjectCommand: PutObjectCommandType;
    DeleteObjectCommand: DeleteObjectCommandType;
    ListObjectsV2Command: ListObjectsV2CommandType;
  } | null = null;

  /**
   * Create a new S3Store.
   *
   * @param config - Store configuration
   */
  constructor(config: S3StoreConfig) {
    this.bucket = config.bucket;
    // Normalize prefix to always end with "/" (unless empty)
    const rawPrefix = config.prefix ?? DEFAULT_PREFIX;
    this.prefix = rawPrefix === "" ? "" : rawPrefix.endsWith("/") ? rawPrefix : `${rawPrefix}/`;
    this.region = config.region ?? process.env.AWS_REGION ?? "us-east-1";
    this.endpoint = config.endpoint;
    this.forcePathStyle = config.forcePathStyle ?? false;
  }

  private async getClient(): Promise<S3ClientType> {
    if (this.client) return this.client;

    try {
      const s3Module = await import("@aws-sdk/client-s3");
      const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = s3Module;

      this.client = new S3Client({
        region: this.region,
        endpoint: this.endpoint,
        forcePathStyle: this.forcePathStyle,
      });

      this.commands = {
        GetObjectCommand,
        PutObjectCommand,
        DeleteObjectCommand,
        ListObjectsV2Command,
      };

      return this.client;
    } catch {
      throw new Error(
        "S3Store requires @aws-sdk/client-s3. Install it with: npm install @aws-sdk/client-s3"
      );
    }
  }

  private getStateKey(key: string): string {
    const sanitized = sanitizeKey(key);
    return `${this.prefix}${sanitized}/${STATE_FILENAME}`;
  }

  private getSearchKey(key: string): string {
    const sanitized = sanitizeKey(key);
    return `${this.prefix}${sanitized}/${SEARCH_FILENAME}`;
  }

  async loadState(key: string): Promise<IndexState | null> {
    const client = await this.getClient();
    const fileKey = this.getStateKey(key);

    try {
      const command = new this.commands!.GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });
      const response = await client.send(command);
      const body = await response.Body?.transformToString();
      if (!body) return null;

      const state = JSON.parse(body) as IndexState;

      // Validate that this is a full state file with blobs
      if (!state.contextState.blobs) {
        throw new Error(
          `Invalid state file for key "${key}": missing blobs field. ` +
          `This appears to be a search.json file. Use loadSearch() instead, or ` +
          `ensure state.json exists for incremental indexing operations.`
        );
      }

      return state;
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }

  async loadSearch(key: string): Promise<IndexStateSearchOnly | null> {
    const client = await this.getClient();
    const fileKey = this.getSearchKey(key);

    try {
      const command = new this.commands!.GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });
      const response = await client.send(command);
      const body = await response.Body?.transformToString();
      if (!body) return null;

      return JSON.parse(body) as IndexStateSearchOnly;
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }

  async save(
    key: string,
    fullState: IndexState,
    searchState: IndexStateSearchOnly
  ): Promise<void> {
    const client = await this.getClient();
    const stateKey = this.getStateKey(key);
    const searchKey = this.getSearchKey(key);

    // Full state for incremental indexing (includes blobs with paths)
    const stateJson = JSON.stringify(fullState, null, 2);

    // Search-optimized state from SDK (no blobs array)
    const searchJson = JSON.stringify(searchState, null, 2);

    // Write both files
    await Promise.all([
      client.send(
        new this.commands!.PutObjectCommand({
          Bucket: this.bucket,
          Key: stateKey,
          Body: stateJson,
          ContentType: "application/json",
        })
      ),
      client.send(
        new this.commands!.PutObjectCommand({
          Bucket: this.bucket,
          Key: searchKey,
          Body: searchJson,
          ContentType: "application/json",
        })
      ),
    ]);
  }

  async delete(key: string): Promise<void> {
    // Guard against empty/unsafe keys
    const sanitized = sanitizeKey(key);
    if (sanitized === "") {
      throw new Error(
        `Invalid index key "${key}": sanitizes to empty string. Cannot delete.`
      );
    }

    const client = await this.getClient();
    const stateKey = this.getStateKey(key);
    const searchKey = this.getSearchKey(key);

    // Delete both state.json and search.json to ensure complete removal
    await Promise.all([
      client.send(
        new this.commands!.DeleteObjectCommand({
          Bucket: this.bucket,
          Key: stateKey,
        })
      ),
      client.send(
        new this.commands!.DeleteObjectCommand({
          Bucket: this.bucket,
          Key: searchKey,
        })
      ),
    ]);
  }

  async list(): Promise<string[]> {
    const client = await this.getClient();
    const keys: string[] = [];

    let continuationToken: string | undefined;
    do {
      const command = new this.commands!.ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
        Delimiter: "/",
        ContinuationToken: continuationToken,
      });
      const response = await client.send(command);

      // CommonPrefixes contains the "directories"
      for (const prefix of response.CommonPrefixes ?? []) {
        if (prefix.Prefix) {
          // Extract key name from prefix (remove base prefix and trailing slash)
          const keyName = prefix.Prefix
            .slice(this.prefix.length)
            .replace(/\/$/, "");
          if (keyName) keys.push(keyName);
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return keys;
  }
}

