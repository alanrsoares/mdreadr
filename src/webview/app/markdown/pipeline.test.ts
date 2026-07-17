import { describe, expect, test } from "bun:test";
import { isSpecialFence } from "./pipeline.tsx";
import { encodeLinkedBadge, LINKED_BADGE_TOKEN_SOURCE } from "./preprocess.ts";

describe("isSpecialFence", () => {
  test("true for the special fence languages", () => {
    for (const language of ["align", "mermaid", "math", "badges"]) {
      expect(isSpecialFence(language)).toBe(true);
    }
  });

  test("false for non-special languages, undefined, and empty string", () => {
    expect(isSpecialFence("ts")).toBe(false);
    expect(isSpecialFence("js")).toBe(false);
    expect(isSpecialFence(undefined)).toBe(false);
    expect(isSpecialFence("")).toBe(false);
  });
});

describe("LINKED_BADGE_TOKEN_SOURCE", () => {
  test("round-trips encodeLinkedBadge output through a fresh regex built from the source", () => {
    const token = encodeLinkedBadge("Alt text", "https://img.example/a.svg", "https://example.com");
    const pattern = new RegExp(LINKED_BADGE_TOKEN_SOURCE, "g");
    const match = pattern.exec(token);

    expect(match).not.toBeNull();
    expect(JSON.parse(match?.[1] ?? "{}")).toEqual({
      alt: "Alt text",
      src: "https://img.example/a.svg",
      href: "https://example.com",
    });
  });
});
