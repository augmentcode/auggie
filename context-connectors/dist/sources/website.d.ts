/**
 * Website Source - Crawls and indexes website content
 */
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
export declare class WebsiteSource implements Source {
    readonly type: "website";
    private readonly startUrl;
    private readonly maxDepth;
    private readonly maxPages;
    private readonly includePaths;
    private readonly excludePaths;
    private readonly respectRobotsTxt;
    private readonly userAgent;
    private readonly delayMs;
    private crawledPages;
    private robotsRules;
    private robotsLoaded;
    constructor(config: WebsiteSourceConfig);
    /**
     * Load and cache cheerio dependency
     */
    private getCheerio;
    /**
     * Load robots.txt rules
     */
    private loadRobotsTxt;
    /**
     * Parse robots.txt content
     */
    private parseRobotsTxt;
    /**
     * Check if a path is allowed by robots.txt
     */
    private isAllowedByRobots;
    /**
     * Check if URL should be crawled based on include/exclude patterns
     */
    private shouldCrawlUrl;
    /**
     * Simple glob pattern matching
     */
    private matchPattern;
    /**
     * Delay helper for rate limiting
     */
    private delay;
    /**
     * Extract links from HTML
     */
    private extractLinks;
    /**
     * Convert HTML to markdown-like text
     */
    private htmlToText;
    /**
     * Crawl a single page
     */
    private crawlPage;
    /**
     * Crawl the website starting from the configured URL
     */
    private crawl;
    fetchAll(): Promise<FileEntry[]>;
    fetchChanges(_previous: SourceMetadata): Promise<FileChanges | null>;
    getMetadata(): Promise<SourceMetadata>;
    listFiles(): Promise<FileInfo[]>;
    readFile(path: string): Promise<string | null>;
}
//# sourceMappingURL=website.d.ts.map