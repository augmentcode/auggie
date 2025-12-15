/**
 * Tests for file-filter module
 */
import { describe, it, expect } from "vitest";
import { shouldFilterFile, alwaysIgnorePath, isKeyishPath, isValidFileSize, isValidUtf8, DEFAULT_MAX_FILE_SIZE, } from "./file-filter.js";
describe("shouldFilterFile", () => {
    it("filters files with '..' in path", () => {
        const result = shouldFilterFile({
            path: "../secret/file.txt",
            content: Buffer.from("hello"),
        });
        expect(result.filtered).toBe(true);
        expect(result.reason).toBe("path_contains_dotdot");
    });
    it("filters keyish files (.pem)", () => {
        const result = shouldFilterFile({
            path: "certs/server.pem",
            content: Buffer.from("-----BEGIN CERTIFICATE-----"),
        });
        expect(result.filtered).toBe(true);
        expect(result.reason).toBe("keyish_pattern");
    });
    it("filters keyish files (.key)", () => {
        const result = shouldFilterFile({
            path: "keys/private.key",
            content: Buffer.from("-----BEGIN PRIVATE KEY-----"),
        });
        expect(result.filtered).toBe(true);
        expect(result.reason).toBe("keyish_pattern");
    });
    it("filters keyish files (id_rsa)", () => {
        const result = shouldFilterFile({
            path: ".ssh/id_rsa",
            content: Buffer.from("-----BEGIN RSA PRIVATE KEY-----"),
        });
        expect(result.filtered).toBe(true);
        expect(result.reason).toBe("keyish_pattern");
    });
    it("filters oversized files", () => {
        const largeContent = Buffer.alloc(DEFAULT_MAX_FILE_SIZE + 1, "a");
        const result = shouldFilterFile({
            path: "large-file.txt",
            content: largeContent,
        });
        expect(result.filtered).toBe(true);
        expect(result.reason).toContain("file_too_large");
    });
    it("filters binary files", () => {
        // Create content with invalid UTF-8 bytes
        const binaryContent = Buffer.from([0x80, 0x81, 0x82, 0xff, 0xfe]);
        const result = shouldFilterFile({
            path: "binary.dat",
            content: binaryContent,
        });
        expect(result.filtered).toBe(true);
        expect(result.reason).toBe("binary_file");
    });
    it("allows valid text files", () => {
        const result = shouldFilterFile({
            path: "src/index.ts",
            content: Buffer.from("export function hello() { return 'world'; }"),
        });
        expect(result.filtered).toBe(false);
        expect(result.reason).toBeUndefined();
    });
    it("allows files with unicode content", () => {
        const result = shouldFilterFile({
            path: "i18n/messages.json",
            content: Buffer.from('{"greeting": "こんにちは", "emoji": "👋"}'),
        });
        expect(result.filtered).toBe(false);
    });
    it("respects custom maxFileSize", () => {
        const content = Buffer.alloc(100, "a");
        const result = shouldFilterFile({
            path: "file.txt",
            content,
            maxFileSize: 50,
        });
        expect(result.filtered).toBe(true);
        expect(result.reason).toContain("file_too_large");
    });
});
describe("alwaysIgnorePath", () => {
    it("returns true for paths with '..'", () => {
        expect(alwaysIgnorePath("../file.txt")).toBe(true);
        expect(alwaysIgnorePath("foo/../bar")).toBe(true);
        expect(alwaysIgnorePath("foo/..")).toBe(true);
    });
    it("returns false for normal paths", () => {
        expect(alwaysIgnorePath("foo/bar.txt")).toBe(false);
        expect(alwaysIgnorePath("src/index.ts")).toBe(false);
    });
});
describe("isKeyishPath", () => {
    it("matches key files", () => {
        expect(isKeyishPath("private.key")).toBe(true);
        expect(isKeyishPath("cert.pem")).toBe(true);
        expect(isKeyishPath("keystore.jks")).toBe(true);
        expect(isKeyishPath("id_rsa")).toBe(true);
        expect(isKeyishPath("id_ed25519")).toBe(true);
    });
    it("does not match normal files", () => {
        expect(isKeyishPath("index.ts")).toBe(false);
        expect(isKeyishPath("README.md")).toBe(false);
    });
});
describe("isValidFileSize", () => {
    it("returns true for files under limit", () => {
        expect(isValidFileSize(1000)).toBe(true);
        expect(isValidFileSize(DEFAULT_MAX_FILE_SIZE)).toBe(true);
    });
    it("returns false for files over limit", () => {
        expect(isValidFileSize(DEFAULT_MAX_FILE_SIZE + 1)).toBe(false);
    });
});
describe("isValidUtf8", () => {
    it("returns true for valid UTF-8", () => {
        expect(isValidUtf8(Buffer.from("hello world"))).toBe(true);
        expect(isValidUtf8(Buffer.from("こんにちは"))).toBe(true);
    });
    it("returns false for invalid UTF-8", () => {
        expect(isValidUtf8(Buffer.from([0x80, 0x81, 0x82]))).toBe(false);
    });
});
//# sourceMappingURL=file-filter.test.js.map