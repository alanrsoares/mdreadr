import { describe, expect, test } from "bun:test";
import {
  abbreviatePathHint,
  buildRecentPathDisplays,
  formatRecentMenuLabels,
} from "./recent-path-labels.ts";

describe("buildRecentPathDisplays", () => {
  test("uses basename only when names are unique", () => {
    const displays = buildRecentPathDisplays([
      "/home/alan/dev/mdreadr/README.md",
      "/home/alan/dev/mdreadr/AGENTS.md",
    ]);

    expect(displays.get("/home/alan/dev/mdreadr/README.md")).toEqual({
      label: "README.md",
    });
    expect(displays.get("/home/alan/dev/mdreadr/AGENTS.md")).toEqual({
      label: "AGENTS.md",
    });
  });

  test("adds parent hints when basenames collide", () => {
    const domainPath = "/home/alan/dev/mdreadr/packages/domain/README.md";
    const apiPath = "/home/alan/dev/mdreadr/packages/api/README.md";
    const docsPath = "/home/alan/dev/mdreadr/docs/README.md";

    const displays = buildRecentPathDisplays([domainPath, apiPath, docsPath]);

    expect(displays.get(domainPath)).toEqual({ label: "README.md", hint: "domain" });
    expect(displays.get(apiPath)).toEqual({ label: "README.md", hint: "api" });
    expect(displays.get(docsPath)).toEqual({ label: "README.md", hint: "docs" });
  });

  test("uses deeper hints when parent folder names also collide", () => {
    const firstPath = "/repo/a/pkg/README.md";
    const secondPath = "/repo/b/pkg/README.md";

    const displays = buildRecentPathDisplays([firstPath, secondPath]);

    expect(displays.get(firstPath)).toEqual({ label: "README.md", hint: "a/pkg" });
    expect(displays.get(secondPath)).toEqual({ label: "README.md", hint: "b/pkg" });
  });
});

describe("formatRecentMenuLabels", () => {
  test("uses full path for aria labels", () => {
    const path = "/home/alan/dev/mdreadr/packages/domain/README.md";
    const labels = formatRecentMenuLabels([path, "/home/alan/dev/mdreadr/packages/api/README.md"]);

    expect(labels.get(path)).toEqual({
      menuLabel: "README.md · domain",
      ariaLabel: path,
    });
  });
});

describe("abbreviatePathHint", () => {
  test("keeps short hints unchanged", () => {
    expect(abbreviatePathHint("packages/domain")).toBe("packages/domain");
  });

  test("abbreviates long hints from the tail", () => {
    const hint = abbreviatePathHint("home/alan/dev/mdreadr/packages/domain/submodule", 20);
    expect(hint.startsWith("…/")).toBe(true);
    expect(hint.endsWith("submodule") || hint.includes("domain")).toBe(true);
  });
});
