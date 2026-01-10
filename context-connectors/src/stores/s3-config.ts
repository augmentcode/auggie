/**
 * S3 configuration from environment variables
 *
 * Environment variables:
 *   CC_S3_BUCKET - S3 bucket name (required for S3 store)
 *   CC_S3_PREFIX - S3 key prefix (default: "context-connectors/")
 *   CC_S3_REGION - AWS region
 *   CC_S3_ENDPOINT - S3-compatible endpoint URL (for MinIO, R2, etc.)
 *   CC_S3_FORCE_PATH_STYLE - Use path-style URLs (set to "true" for some S3-compatible services)
 */

export interface S3Config {
  bucket: string;
  prefix: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

/**
 * Get S3 configuration from environment variables.
 * Returns config with bucket potentially undefined if CC_S3_BUCKET is not set.
 */
export function getS3Config(): S3Config {
  return {
    bucket: process.env.CC_S3_BUCKET || "",
    prefix: process.env.CC_S3_PREFIX || "context-connectors/",
    region: process.env.CC_S3_REGION,
    endpoint: process.env.CC_S3_ENDPOINT,
    forcePathStyle: process.env.CC_S3_FORCE_PATH_STYLE === "true",
  };
}

