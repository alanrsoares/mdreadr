import { describe, expect, test } from "bun:test";
import { formatDisplayPath, formatRecentMenuLabels, pathFileName } from "./path-display.ts";

describe("formatDisplayPath", () => {
  test("replaces a known home directory with tilde", () => {
    expect(formatDisplayPath("/home/alan/dev/mdreadr/README.md", "/home/alan")).toBe(
      "~/dev/mdreadr/README.md",
    );
  });

  test("returns tilde for the home directory itself", () => {
    expect(formatDisplayPath("/home/alan", "/home/alan")).toBe("~");
  });

  test("leaves paths outside the home directory unchanged", () => {
    expect(formatDisplayPath("/tmp/readme.md", "/home/alan")).toBe("/tmp/readme.md");
  });

  test("falls back to /home/{user} when home is unknown", () => {
    expect(formatDisplayPath("/home/alan/dev/mdreadr/README.md")).toBe("~/dev/mdreadr/README.md");
  });

  test("falls back to /Users/{user} on mac-style paths", () => {
    expect(formatDisplayPath("/Users/alan/Documents/notes.md")).toBe("~/Documents/notes.md");
  });

  test("leaves non-home paths unchanged when home is unknown", () => {
    expect(formatDisplayPath("/tmp/readme.md")).toBe("/tmp/readme.md");
  });

  test("normalizes backslashes before matching", () => {
    expect(formatDisplayPath("\\home\\alan\\dev\\notes.md", "/home/alan")).toBe("~/dev/notes.md");
  });

  test("normalizes a trailing slash on the home directory", () => {
    expect(formatDisplayPath("/home/alan/dev/notes.md", "/home/alan/")).toBe("~/dev/notes.md");
  });
});

describe("formatRecentMenuLabels", () => {
  test("uses basename only when names are unique", () => {
    const labels = formatRecentMenuLabels([
      "/home/alan/dev/mdreadr/README.md",
      "/home/alan/dev/mdreadr/AGENTS.md",
    ]);

    expect(labels.get("/home/alan/dev/mdreadr/README.md")).toEqual({
      menuLabel: "README.md",
      ariaLabel: "/home/alan/dev/mdreadr/README.md",
    });
    expect(labels.get("/home/alan/dev/mdreadr/AGENTS.md")).toEqual({
      menuLabel: "AGENTS.md",
      ariaLabel: "/home/alan/dev/mdreadr/AGENTS.md",
    });
  });

  test("adds parent hints when basenames collide", () => {
    const domainPath = "/home/alan/dev/mdreadr/packages/domain/README.md";
    const apiPath = "/home/alan/dev/mdreadr/packages/api/README.md";
    const docsPath = "/home/alan/dev/mdreadr/docs/README.md";

    const labels = formatRecentMenuLabels([domainPath, apiPath, docsPath]);

    expect(labels.get(domainPath)).toEqual({
      menuLabel: "README.md · domain",
      ariaLabel: domainPath,
    });
    expect(labels.get(apiPath)).toEqual({ menuLabel: "README.md · api", ariaLabel: apiPath });
    expect(labels.get(docsPath)).toEqual({ menuLabel: "README.md · docs", ariaLabel: docsPath });
  });

  test("uses deeper hints when parent folder names also collide", () => {
    const firstPath = "/repo/a/pkg/README.md";
    const secondPath = "/repo/b/pkg/README.md";

    const labels = formatRecentMenuLabels([firstPath, secondPath]);

    expect(labels.get(firstPath)).toEqual({ menuLabel: "README.md · a/pkg", ariaLabel: firstPath });
    expect(labels.get(secondPath)).toEqual({
      menuLabel: "README.md · b/pkg",
      ariaLabel: secondPath,
    });
  });

  test("abbreviates long hints with an ellipsis prefix", () => {
    const firstPath = "/really-long-directory-name-that-is-over-32-chars-aaa/README.md";
    const secondPath = "/really-long-directory-name-that-is-over-32-chars-bbb/README.md";

    const labels = formatRecentMenuLabels([firstPath, secondPath]);

    const firstLabel = labels.get(firstPath);
    expect(firstLabel).toBeDefined();
    expect(firstLabel?.menuLabel.includes("…/")).toBe(true);
    expect(firstLabel?.ariaLabel).toBe(firstPath);
  });

  test("ariaLabel is always the full path", () => {
    const path = "/home/alan/dev/mdreadr/packages/domain/README.md";
    const labels = formatRecentMenuLabels([path, "/home/alan/dev/mdreadr/packages/api/README.md"]);

    expect(labels.get(path)?.ariaLabel).toBe(path);
  });
});

describe("pathFileName", () => {
  test("posix path", () => {
    expect(pathFileName("/home/alan/dev/mdreadr/README.md")).toBe("README.md");
  });

  test("windows path", () => {
    expect(pathFileName("C:\\Users\\alan\\notes.md")).toBe("notes.md");
  });

  test("trailing slash", () => {
    expect(pathFileName("/home/alan/dev/")).toBe("dev");
  });

  test("bare name", () => {
    expect(pathFileName("README.md")).toBe("README.md");
  });
});
