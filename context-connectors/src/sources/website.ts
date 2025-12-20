/**
 * Website Source - Crawls and indexes website content
 */

import { isoTimestamp } from "../core/utils.js";
import type { FileEntry, FileInfo, SourceMetadata } from "../core/types.js";
import type { FileChanges, Source } from "./types.js";

/** Configuration for WebsiteSource */
export interface WebsiteSourceConfig {
  /** Starting URL to crawl */
  url: string;
  /** Maximum crawl depth. Defaults to 3 */
  maxDepth?: number;
  /** Maximum pages to crawl. Defaults to 100 */
  maxPages?: number;
  /** URL patterns to include (glob patterns) */
  includePaths?: string[];
  /** URL patterns to exclude (glob patterns) */
  excludePaths?: string[];
  /** Whether to respect robots.txt. Defaults to true */
  respectRobotsTxt?: boolean;
  /** Custom user agent string */
  userAgent?: string;
  /** Delay between requests in ms. Defaults to 100 */
  delayMs?: number;
}

// Types for dynamically imported dependencies
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheerioAPI = any;

interface CrawledPage {
  url: string;
  path: string;
  content: string;
  title: string;
}

export class WebsiteSource implements Source {
  readonly type = "website" as const;
  private readonly startUrl: URL;
  private readonly maxDepth: number;
  private readonly maxPages: number;
  private readonly includePaths: string[];
  private readonly excludePaths: string[];
  private readonly respectRobotsTxt: boolean;
  private readonly userAgent: string;
  private readonly delayMs: number;
  private crawledPages: CrawledPage[] = [];
  private robotsRules: Set<string> = new Set();
  private robotsLoaded = false;

  constructor(config: WebsiteSourceConfig) {
    this.startUrl = new URL(config.url);
    this.maxDepth = config.maxDepth ?? 3;
    this.maxPages = config.maxPages ?? 100;
    this.includePaths = config.includePaths ?? [];
    this.excludePaths = config.excludePaths ?? [];
    this.respectRobotsTxt = config.respectRobotsTxt ?? true;
    this.userAgent = config.userAgent ?? "ContextConnectors/1.0";
    this.delayMs = config.delayMs ?? 100;
  }

  /**
   * Load and cache cheerio dependency
   */
  private async getCheerio(): Promise<{ load: (html: string) => CheerioAPI }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await import("cheerio" as any)) as { load: (html: string) => CheerioAPI };
    } catch {
      throw new Error(
        "WebsiteSource requires cheerio. Install it with: npm install cheerio"
      );
    }
  }

  /**
   * Load robots.txt rules
   */
  private async loadRobotsTxt(): Promise<void> {
    if (this.robotsLoaded || !this.respectRobotsTxt) {
      return;
    }

    try {
      const robotsUrl = new URL("/robots.txt", this.startUrl.origin);
      const response = await fetch(robotsUrl.href, {
        headers: { "User-Agent": this.userAgent },
      });

      if (response.ok) {
        const text = await response.text();
        this.parseRobotsTxt(text);
      }
    } catch {
      // Ignore errors loading robots.txt
    }

    this.robotsLoaded = true;
  }

  /**
   * Parse robots.txt content
   */
  private parseRobotsTxt(content: string): void {
    let inUserAgentBlock = false;
    
    for (const line of content.split("\n")) {
      const trimmed = line.trim().toLowerCase();
      
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.substring(11).trim();
        inUserAgentBlock = agent === "*" || agent === this.userAgent.toLowerCase();
      } else if (inUserAgentBlock && trimmed.startsWith("disallow:")) {
        const path = trimmed.substring(9).trim();
        if (path) {
          this.robotsRules.add(path);
        }
      }
    }
  }

  /**
   * Check if a path is allowed by robots.txt
   */
  private isAllowedByRobots(path: string): boolean {
    if (!this.respectRobotsTxt) {
      return true;
    }

    for (const rule of this.robotsRules) {
      if (path.startsWith(rule)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if URL should be crawled based on include/exclude patterns
   */
  private shouldCrawlUrl(url: URL): boolean {
    const path = url.pathname;

    // Check exclude patterns first
    for (const pattern of this.excludePaths) {
      if (this.matchPattern(path, pattern)) {
        return false;
      }
    }

    // If include patterns specified, must match one
    if (this.includePaths.length > 0) {
      return this.includePaths.some((pattern) => this.matchPattern(path, pattern));
    }

    return true;
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    return regex.test(path);
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Extract links from HTML
   */
  private extractLinks($: CheerioAPI, baseUrl: URL): URL[] {
    const links: URL[] = [];

    $("a[href]").each((_: number, element: unknown) => {
      try {
        const href = $(element).attr("href");
        if (!href) return;

        // Skip non-http links
        if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
          return;
        }

        const url = new URL(href, baseUrl.href);

        // Only follow same-origin links
        if (url.origin === this.startUrl.origin) {
          // Normalize URL (remove hash, trailing slash)
          url.hash = "";
          if (url.pathname !== "/" && url.pathname.endsWith("/")) {
            url.pathname = url.pathname.slice(0, -1);
          }
          links.push(url);
        }
      } catch {
        // Invalid URL, skip
      }
    });

    return links;
  }

  /**
   * Convert HTML to markdown-like text
   */
  private htmlToText($: CheerioAPI): string {
    // Remove script, style, and nav elements
    $("script, style, nav, header, footer, aside").remove();

    // Get title
    const title = $("title").text().trim();

    // Get main content - prefer article or main, fallback to body
    let content = $("article, main, [role=main]").first();
    if (content.length === 0) {
      content = $("body");
    }

    // Convert headings
    content.find("h1, h2, h3, h4, h5, h6").each((_: number, el: unknown) => {
      const level = parseInt($(el).prop("tagName").substring(1));
      const prefix = "#".repeat(level);
      $(el).replaceWith(`\n\n${prefix} ${$(el).text().trim()}\n\n`);
    });

    // Convert paragraphs
    content.find("p").each((_: number, el: unknown) => {
      $(el).replaceWith(`\n\n${$(el).text().trim()}\n\n`);
    });

    // Convert lists
    content.find("li").each((_: number, el: unknown) => {
      $(el).replaceWith(`\n- ${$(el).text().trim()}`);
    });

    // Convert code blocks
    content.find("pre, code").each((_: number, el: unknown) => {
      $(el).replaceWith(`\n\`\`\`\n${$(el).text()}\n\`\`\`\n`);
    });

    // Get text content
    let text = content.text();

    // Clean up whitespace
    text = text
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();

    // Add title as heading if present
    if (title) {
      text = `# ${title}\n\n${text}`;
    }

    return text;
  }

  /**
   * Crawl a single page
   */
  private async crawlPage(url: URL): Promise<{ content: string; title: string; links: URL[] } | null> {
    try {
      const response = await fetch(url.href, {
        headers: {
          "User-Agent": this.userAgent,
          "Accept": "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        return null;
      }

      const html = await response.text();
      const cheerio = await this.getCheerio();
      const $ = cheerio.load(html);

      const title = $("title").text().trim() || url.pathname;
      const content = this.htmlToText($);
      const links = this.extractLinks($, url);

      return { content, title, links };
    } catch {
      return null;
    }
  }

  /**
   * Crawl the website starting from the configured URL
   */
  private async crawl(): Promise<void> {
    await this.loadRobotsTxt();

    const visited = new Set<string>();
    const queue: Array<{ url: URL; depth: number }> = [{ url: this.startUrl, depth: 0 }];
    this.crawledPages = [];

    console.log(`Starting crawl from ${this.startUrl.href} (max depth: ${this.maxDepth}, max pages: ${this.maxPages})`);

    while (queue.length > 0 && this.crawledPages.length < this.maxPages) {
      const { url, depth } = queue.shift()!;
      const urlKey = url.href;

      if (visited.has(urlKey)) {
        continue;
      }
      visited.add(urlKey);

      // Check robots.txt
      if (!this.isAllowedByRobots(url.pathname)) {
        continue;
      }

      // Rate limiting
      if (visited.size > 1) {
        await this.delay(this.delayMs);
      }

      const result = await this.crawlPage(url);
      if (!result) {
        continue;
      }

      // Add links to queue if within depth limit (always traverse to discover pages)
      if (depth < this.maxDepth) {
        for (const link of result.links) {
          if (!visited.has(link.href)) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }

      // Check include/exclude patterns for indexing (not for traversal)
      if (!this.shouldCrawlUrl(url)) {
        continue;
      }

      // Create a path from the URL for storage
      let path = url.pathname;
      if (path === "/" || path === "") {
        path = "/index";
      }
      // Remove leading slash and add .md extension
      path = path.replace(/^\//, "") + ".md";

      this.crawledPages.push({
        url: url.href,
        path,
        content: result.content,
        title: result.title,
      });

      console.log(`Crawled: ${url.pathname} (${this.crawledPages.length}/${this.maxPages})`);
    }

    console.log(`Crawl complete. Indexed ${this.crawledPages.length} pages.`);
  }

  async fetchAll(): Promise<FileEntry[]> {
    await this.crawl();

    return this.crawledPages.map((page) => ({
      path: page.path,
      contents: page.content,
    }));
  }

  async fetchChanges(_previous: SourceMetadata): Promise<FileChanges | null> {
    // Websites don't have a good mechanism for incremental updates
    // Always return null to trigger a full re-crawl
    return null;
  }

  async getMetadata(): Promise<SourceMetadata> {
    return {
      type: "website",
      identifier: this.startUrl.hostname,
      ref: isoTimestamp(), // Use timestamp as "ref" since websites don't have versions
      syncedAt: isoTimestamp(),
    };
  }

  async listFiles(): Promise<FileInfo[]> {
    // If we haven't crawled yet, do a crawl
    if (this.crawledPages.length === 0) {
      await this.crawl();
    }

    return this.crawledPages.map((page) => ({ path: page.path }));
  }

  async readFile(path: string): Promise<string | null> {
    // Check if we have the file from a previous crawl
    const page = this.crawledPages.find((p) => p.path === path);
    if (page) {
      return page.content;
    }

    // Try to construct URL from path and fetch
    try {
      // Remove .md extension and reconstruct URL
      let urlPath = path.replace(/\.md$/, "");
      if (urlPath === "index") {
        urlPath = "/";
      } else {
        urlPath = "/" + urlPath;
      }

      const url = new URL(urlPath, this.startUrl.origin);
      const result = await this.crawlPage(url);
      return result?.content ?? null;
    } catch {
      return null;
    }
  }
}

