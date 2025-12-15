# Phase 9: Additional Sources

## Overview

This phase adds more data sources beyond Filesystem and GitHub. The primary candidates are GitLab and Website crawling.

**Depends on**: Phase 8 complete

## Requirements Discussion (Complete First)

Before implementing, evaluate which sources provide the most value:

### 1. GitLab Source

**Similarities to GitHub:**
- API structure (repos, commits, compare)
- Tarball download for full indexing
- Compare API for incremental updates

**Differences:**
- Different API endpoints and authentication
- Self-hosted instances common (configurable base URL)
- Different rate limiting

**Questions to consider:**
- How many users need GitLab vs GitHub?
- Should we abstract common Git forge logic?
- Priority: Implement if there's clear user demand

### 2. Website Source

**Use cases:**
- Index documentation sites
- Index API references
- Index knowledge bases

**Challenges:**
- Crawling is complex (links, depth, rate limiting)
- Content extraction (HTML → text/markdown)
- Dynamic sites (SPA, JavaScript rendering)
- Robots.txt compliance
- Incremental updates (no easy diff mechanism)

**Questions to consider:**
- Is this better suited as a separate tool?
- Should we use an existing crawler library?
- How to handle authentication (login-protected docs)?

### 3. Alternative Sources to Consider

| Source | Use Case | Complexity | Notes |
|--------|----------|------------|-------|
| **Bitbucket** | Enterprise Git hosting | Medium | Similar to GitHub/GitLab |
| **Azure DevOps** | Microsoft ecosystem | Medium | Git repos + wikis |
| **Confluence** | Documentation | Medium | REST API, pages/spaces |
| **Notion** | Documentation | Low-Medium | API available |
| **Google Docs** | Documents | Medium | OAuth required |
| **Slack** | Chat history | High | Rate limits, pagination |
| **Local Git** | Git repos without remote | Low | Use git CLI |

### 4. Recommendation Format

After analysis, provide recommendations:

```markdown
## Recommended Sources

### Priority 1: [Source Name]
- **Why**: [Reasoning]
- **Target users**: [Who benefits]
- **Implementation complexity**: Low/Medium/High

### Priority 2: [Source Name]
- **Why**: [Reasoning]
- **Target users**: [Who benefits]
- **Implementation complexity**: Low/Medium/High

### Defer/Skip: [Source Names]
- **Why**: [Reasoning]
```

---

## Implementation: GitLab Source

If GitLab is selected, implement following the GitHub pattern.

### 1. `src/sources/gitlab.ts`

```typescript
export interface GitLabSourceConfig {
  token?: string;              // Default: process.env.GITLAB_TOKEN
  baseUrl?: string;            // Default: https://gitlab.com
  projectId: string;           // Project ID or path (e.g., "group/project")
  ref?: string;                // Branch/tag/commit (default: "HEAD")
}

export class GitLabSource implements Source {
  readonly type = "gitlab" as const;
  
  constructor(config: GitLabSourceConfig) { }
  
  async fetchAll(): Promise<FileEntry[]> {
    // Download repository archive
    // GET /projects/:id/repository/archive
  }
  
  async fetchChanges(previous: SourceMetadata): Promise<FileChanges | null> {
    // Compare commits
    // GET /projects/:id/repository/compare
  }
  
  async getMetadata(): Promise<SourceMetadata> {
    return {
      type: "gitlab",
      identifier: this.projectId,
      ref: await this.resolveRef(),
      syncedAt: new Date().toISOString(),
    };
  }
  
  async listFiles(): Promise<FileInfo[]> {
    // GET /projects/:id/repository/tree?recursive=true
  }
  
  async readFile(path: string): Promise<string | null> {
    // GET /projects/:id/repository/files/:file_path/raw
  }
}
```

### 2. Update CLI commands

Add GitLab options to `cmd-index.ts` and `cmd-search.ts`:

```typescript
.option("--gitlab-url <url>", "GitLab base URL", "https://gitlab.com")
.option("--project <id>", "GitLab project ID or path")

if (options.source === "gitlab") {
  const { GitLabSource } = await import("../sources/gitlab.js");
  source = new GitLabSource({
    baseUrl: options.gitlabUrl,
    projectId: options.project,
    ref: options.ref,
  });
}
```

---

## Implementation: Website Source

If Website is selected, implement with caution for complexity.

### 1. `src/sources/website.ts`

```typescript
export interface WebsiteSourceConfig {
  url: string;                 // Starting URL
  maxDepth?: number;           // Default: 3
  maxPages?: number;           // Default: 100
  includePaths?: string[];     // URL patterns to include
  excludePaths?: string[];     // URL patterns to exclude
  respectRobotsTxt?: boolean;  // Default: true
  userAgent?: string;          // Custom user agent
  delayMs?: number;            // Delay between requests (default: 100)
}

export class WebsiteSource implements Source {
  readonly type = "website" as const;
  
  constructor(config: WebsiteSourceConfig) { }
  
  async fetchAll(): Promise<FileEntry[]> {
    // Crawl website starting from URL
    // Convert HTML to markdown/text
    // Return as FileEntry[] where path = URL path
  }
  
  async fetchChanges(previous: SourceMetadata): Promise<FileChanges | null> {
    // No easy way to detect changes
    // Option 1: Always return null (full re-index)
    // Option 2: Check Last-Modified headers
    // Option 3: Compare content hashes
    return null;
  }
  
  async getMetadata(): Promise<SourceMetadata> {
    return {
      type: "website",
      identifier: new URL(this.url).hostname,
      ref: new Date().toISOString(), // Use timestamp as "ref"
      syncedAt: new Date().toISOString(),
    };
  }
  
  async listFiles(): Promise<FileInfo[]> {
    // Return cached list from last crawl
    // Or do a lightweight crawl (HEAD requests only)
  }

  async readFile(path: string): Promise<string | null> {
    // Fetch single page
    // Convert to text
  }
}
```

### 2. Dependencies for Website Source

```json
{
  "peerDependencies": {
    "cheerio": ">=1.0.0",
    "turndown": ">=7.0.0"
  }
}
```

- `cheerio`: HTML parsing and traversal
- `turndown`: HTML to Markdown conversion

### 3. Update CLI for Website

```typescript
.option("--max-depth <n>", "Maximum crawl depth", parseInt, 3)
.option("--max-pages <n>", "Maximum pages to crawl", parseInt, 100)

if (options.source === "website") {
  const { WebsiteSource } = await import("../sources/website.js");
  source = new WebsiteSource({
    url: options.url,
    maxDepth: options.maxDepth,
    maxPages: options.maxPages,
  });
}
```

---

## Acceptance Criteria

- [ ] Requirements discussion completed
- [ ] Selected sources implemented
- [ ] Each source has corresponding tests
- [ ] CLI supports new source types
- [ ] `npm run build` compiles without errors
- [ ] All tests pass

## Testing

### GitLab Tests (`src/sources/gitlab.test.ts`)

```typescript
describe("GitLabSource", () => {
  describe("unit tests", () => {
    it("resolves ref to commit SHA");
    it("fetches all files from archive");
    it("applies file filtering");
    it("detects force push");
    it("lists files via tree API");
    it("reads single file");
  });

  describe.skipIf(!process.env.GITLAB_TOKEN)("integration", () => {
    it("indexes a public GitLab project");
    it("fetches changes between commits");
  });
});
```

### Website Tests (`src/sources/website.test.ts`)

```typescript
describe("WebsiteSource", () => {
  describe("unit tests", () => {
    it("crawls pages up to maxDepth");
    it("respects maxPages limit");
    it("extracts links from HTML");
    it("converts HTML to markdown");
    it("respects robots.txt");
    it("handles rate limiting");
  });

  describe("integration", () => {
    it("crawls a test website");
  });
});
```

## CLI Usage Examples

### GitLab

```bash
# Index GitLab.com project
context-connectors index -s gitlab --project mygroup/myproject -k myproject

# Index self-hosted GitLab
context-connectors index -s gitlab \
  --gitlab-url https://gitlab.mycompany.com \
  --project 123 \
  -k internal-project

# With specific ref
context-connectors index -s gitlab --project mygroup/myproject --ref develop -k myproject-dev
```

### Website

```bash
# Index documentation site
context-connectors index -s website --url https://docs.example.com -k example-docs

# With depth/page limits
context-connectors index -s website \
  --url https://docs.example.com \
  --max-depth 2 \
  --max-pages 50 \
  -k example-docs
```

## Implementation Notes

### GitLab API Reference

| Endpoint | Purpose |
|----------|---------|
| `GET /projects/:id` | Get project info |
| `GET /projects/:id/repository/commits/:sha` | Resolve ref |
| `GET /projects/:id/repository/archive` | Download archive |
| `GET /projects/:id/repository/compare` | Compare commits |
| `GET /projects/:id/repository/tree` | List files |
| `GET /projects/:id/repository/files/:path/raw` | Read file |

### Website Crawling Considerations

1. **Politeness**: Respect robots.txt, add delays between requests
2. **Scope**: Only crawl within the same domain
3. **Deduplication**: Normalize URLs, avoid duplicate content
4. **Content extraction**: Use readability algorithms or target main content
5. **Error handling**: Handle 404s, redirects, timeouts gracefully
6. **Resume**: Consider saving crawl state for large sites

### Abstracting Git Forge Logic

If implementing multiple Git forges (GitHub, GitLab, Bitbucket), consider:

```typescript
// src/sources/git-forge.ts
abstract class GitForgeSource implements Source {
  abstract downloadArchive(): Promise<Buffer>;
  abstract compareCommits(base: string, head: string): Promise<Comparison>;
  abstract getFile(path: string, ref: string): Promise<string>;

  // Shared logic
  async fetchAll(): Promise<FileEntry[]> {
    const archive = await this.downloadArchive();
    return this.extractArchive(archive);
  }

  protected extractArchive(buffer: Buffer): FileEntry[] {
    // Shared tarball extraction
  }
}
```

## Notes

- GitLab uses project IDs (numeric) or paths (group/project)
- Self-hosted GitLab may have different API versions
- Website crawling is inherently slow - consider async/parallel requests
- Large websites may need pagination in listFiles
- Consider sitemap.xml as an alternative to crawling

