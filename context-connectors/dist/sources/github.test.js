/**
 * Tests for GitHubSource
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubSource } from "./github.js";
// Mock data
const mockCommitSha = "abc123def456";
const mockFiles = [
    { path: "README.md", type: "blob" },
    { path: "src/index.ts", type: "blob" },
    { path: "src", type: "tree" },
];
describe("GitHubSource", () => {
    const originalEnv = process.env.GITHUB_TOKEN;
    beforeEach(() => {
        process.env.GITHUB_TOKEN = "test-token";
    });
    afterEach(() => {
        if (originalEnv) {
            process.env.GITHUB_TOKEN = originalEnv;
        }
        else {
            delete process.env.GITHUB_TOKEN;
        }
        vi.restoreAllMocks();
    });
    describe("constructor", () => {
        it("uses provided token", () => {
            expect(() => {
                new GitHubSource({
                    token: "custom-token",
                    owner: "test",
                    repo: "repo",
                });
            }).not.toThrow();
        });
        it("uses GITHUB_TOKEN from env", () => {
            expect(() => {
                new GitHubSource({
                    owner: "test",
                    repo: "repo",
                });
            }).not.toThrow();
        });
        it("throws if no token available", () => {
            delete process.env.GITHUB_TOKEN;
            expect(() => {
                new GitHubSource({
                    owner: "test",
                    repo: "repo",
                });
            }).toThrow(/GitHub token required/);
        });
        it("uses HEAD as default ref", () => {
            const source = new GitHubSource({
                owner: "test",
                repo: "repo",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.ref).toBe("HEAD");
        });
        it("accepts custom ref", () => {
            const source = new GitHubSource({
                owner: "test",
                repo: "repo",
                ref: "develop",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.ref).toBe("develop");
        });
    });
    describe("type", () => {
        it("returns 'github'", () => {
            const source = new GitHubSource({
                owner: "test",
                repo: "repo",
            });
            expect(source.type).toBe("github");
        });
    });
    // Integration tests - only run if GITHUB_TOKEN is available
    const hasToken = !!process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== "test-token";
    describe.skipIf(!hasToken)("integration", () => {
        it("indexes a public repo", async () => {
            const source = new GitHubSource({
                owner: "octocat",
                repo: "Hello-World",
                ref: "master",
            });
            const files = await source.fetchAll();
            expect(files.length).toBeGreaterThan(0);
        });
        it("lists files from a public repo", async () => {
            const source = new GitHubSource({
                owner: "octocat",
                repo: "Hello-World",
                ref: "master",
            });
            const files = await source.listFiles();
            expect(files.length).toBeGreaterThan(0);
            expect(files[0]).toHaveProperty("path");
        });
        it("reads a single file from a public repo", async () => {
            const source = new GitHubSource({
                owner: "octocat",
                repo: "Hello-World",
                ref: "master",
            });
            const content = await source.readFile("README");
            expect(content).not.toBeNull();
        });
        it("returns null for missing file", async () => {
            const source = new GitHubSource({
                owner: "octocat",
                repo: "Hello-World",
                ref: "master",
            });
            const content = await source.readFile("nonexistent-file.txt");
            expect(content).toBeNull();
        });
        it("gets correct metadata", async () => {
            const source = new GitHubSource({
                owner: "octocat",
                repo: "Hello-World",
                ref: "master",
            });
            const metadata = await source.getMetadata();
            expect(metadata.type).toBe("github");
            expect(metadata.identifier).toBe("octocat/Hello-World");
            expect(metadata.ref).toBeDefined();
            expect(metadata.syncedAt).toBeDefined();
        });
    });
});
//# sourceMappingURL=github.test.js.map