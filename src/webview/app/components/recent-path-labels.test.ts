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
    const paths = [
      "/home/alan/dev/mdreadr/packages/domain/README.md",
      "/home/alan/dev/mdreadr/packages/api/README.md",
      "/home/alan/dev/mdreadr/docs/README.md",
    ];

    const displays = buildRecentPathDisplays(paths);

    expect(displays.get(paths[0]!)).toEqual({ label: "README.md", hint: "domain" });
    expect(displays.get(paths[1]!)).toEqual({ label: "README.md", hint: "api" });
    expect(displays.get(paths[2]!)).toEqual({ label: "README.md", hint: "docs" });
  });

  test("uses deeper hints when parent folder names also collide", () => {
    const paths = ["/repo/a/pkg/README.md", "/repo/b/pkg/README.md"];

    const displays = buildRecentPathDisplays(paths);

    expect(displays.get(paths[0]!)).toEqual({ label: "README.md", hint: "a/pkg" });
    expect(displays.get(paths[1]!)).toEqual({ label: "README.md", hint: "b/pkg" });
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
