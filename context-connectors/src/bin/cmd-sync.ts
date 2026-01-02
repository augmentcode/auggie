/**
 * Sync command - Update existing indexes to latest
 */

import { Command } from "commander";
import { Indexer } from "../core/indexer.js";
import { FilesystemStore } from "../stores/filesystem.js";
import { FilesystemSource } from "../sources/filesystem.js";
import { Source } from "../sources/types.js";
import { IndexState, getSourceIdentifier } from "../core/types.js";

// Shared store options
interface StoreOptions {
  store: string;
  storePath?: string;
  bucket?: string;
  s3Prefix: string;
  s3Region?: string;
  s3Endpoint?: string;
  s3ForcePathStyle?: boolean;
}

function addStoreOptions(cmd: Command): Command {
  return cmd
    .option("--store <type>", "Store type (filesystem, s3)", "filesystem")
    .option("--store-path <path>", "Store base path")
    .option("--bucket <name>", "S3 bucket name (required for s3 store)")
    .option("--s3-prefix <prefix>", "S3 key prefix", "context-connectors/")
    .option("--s3-region <region>", "S3 region")
    .option("--s3-endpoint <url>", "S3-compatible endpoint URL")
    .option("--s3-force-path-style", "Use path-style S3 URLs");
}

async function createStore(options: StoreOptions) {
  if (options.store === "filesystem") {
    return new FilesystemStore({ basePath: options.storePath });
  } else if (options.store === "s3") {
    if (!options.bucket) {
      console.error("S3 store requires --bucket option");
      process.exit(1);
    }
    const { S3Store } = await import("../stores/s3.js");
    return new S3Store({
      bucket: options.bucket,
      prefix: options.s3Prefix,
      region: options.s3Region,
      endpoint: options.s3Endpoint,
      forcePathStyle: options.s3ForcePathStyle,
    });
  } else {
    console.error(`Unknown store type: ${options.store}`);
    process.exit(1);
  }
}

/** Create a Source from index state metadata */
async function createSourceFromState(state: IndexState): Promise<Source> {
  const meta = state.source;

  if (meta.type === "filesystem") {
    return new FilesystemSource(meta.config);
  } else if (meta.type === "github") {
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

async function syncIndex(
  name: string,
  store: Awaited<ReturnType<typeof createStore>>
): Promise<boolean> {
  const state = await store.load(name);
  if (!state) {
    console.error(`Index "${name}" not found`);
    return false;
  }

  const source = await createSourceFromState(state);
  const identifier = getSourceIdentifier(state.source);
  console.log(`Syncing ${name} (${state.source.type}://${identifier})...`);

  const indexer = new Indexer();
  const result = await indexer.index(source, store, name);

  console.log(`  ${result.type}: ${result.filesIndexed} indexed, ${result.filesRemoved} removed (${result.duration}ms)`);
  return true;
}

// Main sync command
export const syncCommand = new Command("sync")
  .description("Sync (update) existing indexes to latest")
  .argument("[name]", "Index name to sync")
  .option("-a, --all", "Sync all indexes");

addStoreOptions(syncCommand);

syncCommand.action(async (name: string | undefined, options: StoreOptions & { all?: boolean }) => {
  try {
    const store = await createStore(options);

    if (options.all) {
      // Sync all indexes
      const keys = await store.list();
      if (keys.length === 0) {
        console.log("No indexes found.");
        return;
      }

      console.log(`Syncing ${keys.length} index(es)...\n`);
      let succeeded = 0;
      let failed = 0;

      for (const key of keys) {
        const ok = await syncIndex(key, store);
        if (ok) succeeded++;
        else failed++;
      }

      console.log(`\nSync complete: ${succeeded} succeeded, ${failed} failed`);
    } else if (name) {
      // Sync single index
      const ok = await syncIndex(name, store);
      if (!ok) process.exit(1);
    } else {
      console.error("Please provide an index name or use --all");
      process.exit(1);
    }
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
});

