import { describe, expect, test } from "bun:test";
import { formatDisplayPath } from "./display-path.ts";

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

  test("normalizes backslashes before matching", () => {
    expect(formatDisplayPath("\\home\\alan\\dev\\notes.md", "/home/alan")).toBe("~/dev/notes.md");
  });
});
