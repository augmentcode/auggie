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
const DEFAULT_PREFIX = "context-connectors/";
const STATE_FILENAME = "state.json";
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
export class S3Store {
    bucket;
    prefix;
    region;
    endpoint;
    forcePathStyle;
    client = null;
    commands = null;
    /**
     * Create a new S3Store.
     *
     * @param config - Store configuration
     */
    constructor(config) {
        this.bucket = config.bucket;
        this.prefix = config.prefix ?? DEFAULT_PREFIX;
        this.region = config.region ?? process.env.AWS_REGION ?? "us-east-1";
        this.endpoint = config.endpoint;
        this.forcePathStyle = config.forcePathStyle ?? false;
    }
    async getClient() {
        if (this.client)
            return this.client;
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
        }
        catch {
            throw new Error("S3Store requires @aws-sdk/client-s3. Install it with: npm install @aws-sdk/client-s3");
        }
    }
    getStateKey(key) {
        return `${this.prefix}${key}/${STATE_FILENAME}`;
    }
    async load(key) {
        const client = await this.getClient();
        const stateKey = this.getStateKey(key);
        try {
            const command = new this.commands.GetObjectCommand({
                Bucket: this.bucket,
                Key: stateKey,
            });
            const response = await client.send(command);
            const body = await response.Body?.transformToString();
            if (!body)
                return null;
            return JSON.parse(body);
        }
        catch (error) {
            const err = error;
            if (err.name === "NoSuchKey") {
                return null;
            }
            throw error;
        }
    }
    async save(key, state) {
        const client = await this.getClient();
        const stateKey = this.getStateKey(key);
        const command = new this.commands.PutObjectCommand({
            Bucket: this.bucket,
            Key: stateKey,
            Body: JSON.stringify(state, null, 2),
            ContentType: "application/json",
        });
        await client.send(command);
    }
    async delete(key) {
        const client = await this.getClient();
        const stateKey = this.getStateKey(key);
        const command = new this.commands.DeleteObjectCommand({
            Bucket: this.bucket,
            Key: stateKey,
        });
        await client.send(command);
    }
    async list() {
        const client = await this.getClient();
        const keys = [];
        let continuationToken;
        do {
            const command = new this.commands.ListObjectsV2Command({
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
                    if (keyName)
                        keys.push(keyName);
                }
            }
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
        return keys;
    }
}
//# sourceMappingURL=s3.js.map