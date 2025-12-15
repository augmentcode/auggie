/**
 * Website Source - Crawls and indexes website content
 */
import { isoTimestamp } from "../core/utils.js";
export class WebsiteSource {
    type = "website";
    startUrl;
    maxDepth;
    maxPages;
    includePaths;
    excludePaths;
    respectRobotsTxt;
    userAgent;
    delayMs;
    crawledPages = [];
    robotsRules = new Set();
    robotsLoaded = false;
    constructor(config) {
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
    async getCheerio() {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (await import("cheerio"));
        }
        catch {
            throw new Error("WebsiteSource requires cheerio. Install it with: npm install cheerio");
        }
    }
    /**
     * Load robots.txt rules
     */
    async loadRobotsTxt() {
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
        }
        catch {
            // Ignore errors loading robots.txt
        }
        this.robotsLoaded = true;
    }
    /**
     * Parse robots.txt content
     */
    parseRobotsTxt(content) {
        let inUserAgentBlock = false;
        for (const line of content.split("\n")) {
            const trimmed = line.trim().toLowerCase();
            if (trimmed.startsWith("user-agent:")) {
                const agent = trimmed.substring(11).trim();
                inUserAgentBlock = agent === "*" || agent === this.userAgent.toLowerCase();
            }
            else if (inUserAgentBlock && trimmed.startsWith("disallow:")) {
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
    isAllowedByRobots(path) {
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
    shouldCrawlUrl(url) {
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
    matchPattern(path, pattern) {
        // Convert glob to regex
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
        return regex.test(path);
    }
    /**
     * Delay helper for rate limiting
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Extract links from HTML
     */
    extractLinks($, baseUrl) {
        const links = [];
        $("a[href]").each((_, element) => {
            try {
                const href = $(element).attr("href");
                if (!href)
                    return;
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
            }
            catch {
                // Invalid URL, skip
            }
        });
        return links;
    }
    /**
     * Convert HTML to markdown-like text
     */
    htmlToText($) {
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
        content.find("h1, h2, h3, h4, h5, h6").each((_, el) => {
            const level = parseInt($(el).prop("tagName").substring(1));
            const prefix = "#".repeat(level);
            $(el).replaceWith(`\n\n${prefix} ${$(el).text().trim()}\n\n`);
        });
        // Convert paragraphs
        content.find("p").each((_, el) => {
            $(el).replaceWith(`\n\n${$(el).text().trim()}\n\n`);
        });
        // Convert lists
        content.find("li").each((_, el) => {
            $(el).replaceWith(`\n- ${$(el).text().trim()}`);
        });
        // Convert code blocks
        content.find("pre, code").each((_, el) => {
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
    async crawlPage(url) {
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
        }
        catch {
            return null;
        }
    }
    /**
     * Crawl the website starting from the configured URL
     */
    async crawl() {
        await this.loadRobotsTxt();
        const visited = new Set();
        const queue = [{ url: this.startUrl, depth: 0 }];
        this.crawledPages = [];
        console.log(`Starting crawl from ${this.startUrl.href} (max depth: ${this.maxDepth}, max pages: ${this.maxPages})`);
        while (queue.length > 0 && this.crawledPages.length < this.maxPages) {
            const { url, depth } = queue.shift();
            const urlKey = url.href;
            if (visited.has(urlKey)) {
                continue;
            }
            visited.add(urlKey);
            // Check robots.txt
            if (!this.isAllowedByRobots(url.pathname)) {
                continue;
            }
            // Check include/exclude patterns
            if (!this.shouldCrawlUrl(url)) {
                continue;
            }
            // Rate limiting
            if (this.crawledPages.length > 0) {
                await this.delay(this.delayMs);
            }
            const result = await this.crawlPage(url);
            if (!result) {
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
            // Add links to queue if within depth limit
            if (depth < this.maxDepth) {
                for (const link of result.links) {
                    if (!visited.has(link.href)) {
                        queue.push({ url: link, depth: depth + 1 });
                    }
                }
            }
        }
        console.log(`Crawl complete. Indexed ${this.crawledPages.length} pages.`);
    }
    async fetchAll() {
        await this.crawl();
        return this.crawledPages.map((page) => ({
            path: page.path,
            contents: page.content,
        }));
    }
    async fetchChanges(_previous) {
        // Websites don't have a good mechanism for incremental updates
        // Always return null to trigger a full re-crawl
        return null;
    }
    async getMetadata() {
        return {
            type: "website",
            identifier: this.startUrl.hostname,
            ref: isoTimestamp(), // Use timestamp as "ref" since websites don't have versions
            syncedAt: isoTimestamp(),
        };
    }
    async listFiles() {
        // If we haven't crawled yet, do a crawl
        if (this.crawledPages.length === 0) {
            await this.crawl();
        }
        return this.crawledPages.map((page) => ({ path: page.path }));
    }
    async readFile(path) {
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
            }
            else {
                urlPath = "/" + urlPath;
            }
            const url = new URL(urlPath, this.startUrl.origin);
            const result = await this.crawlPage(url);
            return result?.content ?? null;
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=website.js.map