/**
 * Tests for WebsiteSource
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebsiteSource } from "./website.js";
describe("WebsiteSource", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe("constructor", () => {
        it("parses URL correctly", () => {
            const source = new WebsiteSource({
                url: "https://example.com/docs",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.startUrl.hostname).toBe("example.com");
        });
        it("uses default maxDepth of 3", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.maxDepth).toBe(3);
        });
        it("accepts custom maxDepth", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
                maxDepth: 5,
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.maxDepth).toBe(5);
        });
        it("uses default maxPages of 100", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.maxPages).toBe(100);
        });
        it("accepts custom maxPages", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
                maxPages: 50,
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.maxPages).toBe(50);
        });
        it("uses default delay of 100ms", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.delayMs).toBe(100);
        });
        it("respects robots.txt by default", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.respectRobotsTxt).toBe(true);
        });
        it("can disable robots.txt", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
                respectRobotsTxt: false,
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.respectRobotsTxt).toBe(false);
        });
    });
    describe("type", () => {
        it("returns 'website'", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
            });
            expect(source.type).toBe("website");
        });
    });
    describe("getMetadata", () => {
        it("returns correct metadata structure", async () => {
            const source = new WebsiteSource({
                url: "https://example.com/docs",
            });
            const metadata = await source.getMetadata();
            expect(metadata.type).toBe("website");
            expect(metadata.identifier).toBe("example.com");
            expect(metadata.ref).toBeDefined();
            expect(metadata.syncedAt).toBeDefined();
        });
    });
    describe("fetchChanges", () => {
        it("always returns null (no incremental updates)", async () => {
            const source = new WebsiteSource({
                url: "https://example.com",
            });
            const changes = await source.fetchChanges({
                type: "website",
                identifier: "example.com",
                syncedAt: new Date().toISOString(),
            });
            expect(changes).toBeNull();
        });
    });
    describe("pattern matching", () => {
        it("matches simple paths", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
                includePaths: ["/docs/*"],
            });
            // @ts-expect-error - accessing private method for testing
            expect(source.matchPattern("/docs/intro", "/docs/*")).toBe(true);
            // @ts-expect-error - accessing private method for testing
            expect(source.matchPattern("/blog/post", "/docs/*")).toBe(false);
        });
        it("matches wildcard patterns", () => {
            const source = new WebsiteSource({
                url: "https://example.com",
            });
            // @ts-expect-error - accessing private method for testing
            expect(source.matchPattern("/docs/v2/guide", "/docs/*/guide")).toBe(true);
        });
    });
    // Integration tests - actually crawl a website
    describe.skip("integration", () => {
        it("crawls a simple website", async () => {
            const source = new WebsiteSource({
                url: "https://example.com",
                maxDepth: 1,
                maxPages: 5,
            });
            const files = await source.fetchAll();
            expect(files.length).toBeGreaterThan(0);
            expect(files[0].contents).toBeDefined();
        });
        it("lists files from crawled site", async () => {
            const source = new WebsiteSource({
                url: "https://example.com",
                maxDepth: 1,
                maxPages: 5,
            });
            const files = await source.listFiles();
            expect(files.length).toBeGreaterThan(0);
            expect(files[0]).toHaveProperty("path");
        });
    });
});
//# sourceMappingURL=website.test.js.map