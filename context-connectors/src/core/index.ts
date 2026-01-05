/**
 * Core module exports
 */

export type {
  FileEntry,
  FileInfo,
  SourceMetadata,
  IndexState,
  IndexStateSearchOnly,
  IndexResult,
} from "./types.js";

export {
  DEFAULT_MAX_FILE_SIZE,
  alwaysIgnorePath,
  isKeyishPath,
  isValidFileSize,
  isValidUtf8,
  shouldFilterFile,
} from "./file-filter.js";

export { sanitizeKey, isoTimestamp } from "./utils.js";

export { Indexer } from "./indexer.js";
export type { IndexerConfig } from "./indexer.js";

