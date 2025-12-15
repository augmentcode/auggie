/**
 * Tests for GitLabSource
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitLabSource } from "./gitlab.js";
describe("GitLabSource", () => {
    const originalEnv = process.env.GITLAB_TOKEN;
    beforeEach(() => {
        process.env.GITLAB_TOKEN = "test-token";
    });
    afterEach(() => {
        if (originalEnv) {
            process.env.GITLAB_TOKEN = originalEnv;
        }
        else {
            delete process.env.GITLAB_TOKEN;
        }
        vi.restoreAllMocks();
    });
    describe("constructor", () => {
        it("uses provided token", () => {
            expect(() => {
                new GitLabSource({
                    token: "custom-token",
                    projectId: "group/project",
                });
            }).not.toThrow();
        });
        it("uses GITLAB_TOKEN from env", () => {
            expect(() => {
                new GitLabSource({
                    projectId: "group/project",
                });
            }).not.toThrow();
        });
        it("throws if no token available", () => {
            delete process.env.GITLAB_TOKEN;
            expect(() => {
                new GitLabSource({
                    projectId: "group/project",
                });
            }).toThrow(/GitLab token required/);
        });
        it("uses HEAD as default ref", () => {
            const source = new GitLabSource({
                projectId: "group/project",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.ref).toBe("HEAD");
        });
        it("accepts custom ref", () => {
            const source = new GitLabSource({
                projectId: "group/project",
                ref: "develop",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.ref).toBe("develop");
        });
        it("uses default GitLab.com URL", () => {
            const source = new GitLabSource({
                projectId: "group/project",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.baseUrl).toBe("https://gitlab.com");
        });
        it("accepts custom base URL for self-hosted", () => {
            const source = new GitLabSource({
                projectId: "group/project",
                baseUrl: "https://gitlab.mycompany.com",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.baseUrl).toBe("https://gitlab.mycompany.com");
        });
        it("strips trailing slash from base URL", () => {
            const source = new GitLabSource({
                projectId: "group/project",
                baseUrl: "https://gitlab.mycompany.com/",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.baseUrl).toBe("https://gitlab.mycompany.com");
        });
        it("URL-encodes project ID", () => {
            const source = new GitLabSource({
                projectId: "group/subgroup/project",
            });
            // @ts-expect-error - accessing private property for testing
            expect(source.encodedProjectId).toBe("group%2Fsubgroup%2Fproject");
        });
    });
    describe("type", () => {
        it("returns 'gitlab'", () => {
            const source = new GitLabSource({
                projectId: "group/project",
            });
            expect(source.type).toBe("gitlab");
        });
    });
    // Integration tests - only run if GITLAB_TOKEN is available
    const hasToken = !!process.env.GITLAB_TOKEN && process.env.GITLAB_TOKEN !== "test-token";
    describe.skipIf(!hasToken)("integration", () => {
        it("indexes a public GitLab project", async () => {
            const source = new GitLabSource({
                projectId: "gitlab-org/gitlab-runner", // A well-known public project
                ref: "main",
            });
            const files = await source.fetchAll();
            expect(files.length).toBeGreaterThan(0);
        });
        it("lists files from a public project", async () => {
            const source = new GitLabSource({
                projectId: "gitlab-org/gitlab-runner",
                ref: "main",
            });
            const files = await source.listFiles();
            expect(files.length).toBeGreaterThan(0);
            expect(files[0]).toHaveProperty("path");
        });
        it("reads a single file from a public project", async () => {
            const source = new GitLabSource({
                projectId: "gitlab-org/gitlab-runner",
                ref: "main",
            });
            const content = await source.readFile("README.md");
            expect(content).not.toBeNull();
        });
        it("returns null for missing file", async () => {
            const source = new GitLabSource({
                projectId: "gitlab-org/gitlab-runner",
                ref: "main",
            });
            const content = await source.readFile("nonexistent-file-12345.txt");
            expect(content).toBeNull();
        });
        it("gets correct metadata", async () => {
            const source = new GitLabSource({
                projectId: "gitlab-org/gitlab-runner",
                ref: "main",
            });
            const metadata = await source.getMetadata();
            expect(metadata.type).toBe("gitlab");
            expect(metadata.identifier).toBe("gitlab-org/gitlab-runner");
            expect(metadata.ref).toBeDefined();
            expect(metadata.syncedAt).toBeDefined();
        });
    });
});
//# sourceMappingURL=gitlab.test.js.map