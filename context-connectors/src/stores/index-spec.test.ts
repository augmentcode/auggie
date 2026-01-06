import { describe, it, expect } from "vitest";
import { parseIndexSpec, parseIndexSpecs } from "./index-spec.js";

describe("parseIndexSpec", () => {
  describe("named indexes", () => {
    it("parses simple name", () => {
      const spec = parseIndexSpec("my-project");
      expect(spec).toEqual({
        type: "name",
        value: "my-project",
        displayName: "my-project",
      });
    });

    it("parses explicit name: prefix", () => {
      const spec = parseIndexSpec("name:my-project");
      expect(spec).toEqual({
        type: "name",
        value: "my-project",
        displayName: "my-project",
      });
    });

    it("throws on empty spec", () => {
      expect(() => parseIndexSpec("")).toThrow("cannot be empty");
      expect(() => parseIndexSpec("   ")).toThrow("cannot be empty");
    });

    it("throws on empty name: prefix", () => {
      expect(() => parseIndexSpec("name:")).toThrow("name cannot be empty");
    });
  });

  describe("path specs", () => {
    it("parses absolute path", () => {
      const spec = parseIndexSpec("path:/data/indexes/my-project");
      expect(spec).toEqual({
        type: "path",
        value: "/data/indexes/my-project",
        displayName: "my-project",
      });
    });

    it("parses relative path", () => {
      const spec = parseIndexSpec("path:./my-project");
      expect(spec).toEqual({
        type: "path",
        value: "./my-project",
        displayName: "my-project",
      });
    });

    it("parses parent relative path", () => {
      const spec = parseIndexSpec("path:../other/project");
      expect(spec).toEqual({
        type: "path",
        value: "../other/project",
        displayName: "project",
      });
    });

    it("throws on empty path", () => {
      expect(() => parseIndexSpec("path:")).toThrow("path cannot be empty");
    });
  });

  describe("S3 specs", () => {
    it("parses S3 URL", () => {
      const spec = parseIndexSpec("s3://my-bucket/prefix/my-project");
      expect(spec).toEqual({
        type: "s3",
        value: "s3://my-bucket/prefix/my-project",
        displayName: "my-project",
      });
    });

    it("parses S3 URL with deep path", () => {
      const spec = parseIndexSpec("s3://bucket/a/b/c/index");
      expect(spec).toEqual({
        type: "s3",
        value: "s3://bucket/a/b/c/index",
        displayName: "index",
      });
    });

    it("throws on S3 URL without path", () => {
      expect(() => parseIndexSpec("s3://bucket")).toThrow(
        "must have bucket and at least one path component"
      );
    });
  });

  describe("unknown schemes", () => {
    it("throws on unknown URL scheme", () => {
      expect(() => parseIndexSpec("http://example.com")).toThrow(
        "Unknown URL scheme"
      );
    });
  });
});

describe("parseIndexSpecs", () => {
  it("parses multiple specs", () => {
    const specs = parseIndexSpecs([
      "my-project",
      "path:/data/other",
      "s3://bucket/third",
    ]);
    expect(specs).toHaveLength(3);
    expect(specs[0].displayName).toBe("my-project");
    expect(specs[1].displayName).toBe("other");
    expect(specs[2].displayName).toBe("third");
  });

  it("handles display name conflicts", () => {
    // Two indexes with same display name
    const specs = parseIndexSpecs([
      "path:/a/project",
      "path:/b/project",
      "path:/c/project",
    ]);
    expect(specs).toHaveLength(3);
    // First keeps original name, subsequent get suffix
    expect(specs[0].displayName).toBe("project");
    expect(specs[1].displayName).toBe("project-2");
    expect(specs[2].displayName).toBe("project-3");
  });
});

