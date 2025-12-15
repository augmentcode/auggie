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
import type { IndexState } from "../core/types.js";
import type { IndexStore } from "./types.js";
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
/**
 * Store implementation that persists to S3-compatible object storage.
 *
 * Creates an object structure:
 * ```
 * {prefix}{key}/
 *   state.json     - Index metadata and file list
 *   context.bin    - DirectContext binary data
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
export declare class S3Store implements IndexStore {
    private readonly bucket;
    private readonly prefix;
    private readonly region;
    private readonly endpoint?;
    private readonly forcePathStyle;
    private client;
    private commands;
    /**
     * Create a new S3Store.
     *
     * @param config - Store configuration
     */
    constructor(config: S3StoreConfig);
    private getClient;
    private getStateKey;
    load(key: string): Promise<IndexState | null>;
    save(key: string, state: IndexState): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<string[]>;
}
//# sourceMappingURL=s3.d.ts.map