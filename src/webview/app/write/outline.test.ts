import { describe, expect, test } from "bun:test";
import { extractHeadings } from "@mdreadr/domain";
import { fencedLines, writeHeadingIndex } from "./outline.ts";

const doc = [
  "# One",
  "",
  "```sh",
  "# comment",
  "```",
  "",
  "## Two",
  "",
  "~~~~",
  "# x",
  "~~~~",
  "# Three",
].join("\n");

describe("fencedLines", () => {
  test("marks fence edges and body, not prose", () => {
    expect([...fencedLines(doc)].sort((a, b) => a - b)).toEqual([2, 3, 4, 8, 9, 10]);
  });

  test("a shorter or different marker does not close a fence", () => {
    const lines = fencedLines(["````", "```", "# a", "~~~~", "````", "# b"].join("\n"));
    expect(lines.has(2)).toBe(true);
    expect(lines.has(5)).toBe(false);
  });
});

describe("writeHeadingIndex", () => {
  const toc = extractHeadings(doc);

  test("skips headings inside fences", () => {
    const byText = (text: string) => toc.find((entry) => entry.text === text);
    expect(writeHeadingIndex(doc, toc, byText("One") as never)).toBe(0);
    expect(writeHeadingIndex(doc, toc, byText("Two") as never)).toBe(1);
    expect(writeHeadingIndex(doc, toc, byText("Three") as never)).toBe(2);
  });

  test("fenced entry has no rendered heading", () => {
    const fenced = toc.find((entry) => entry.text === "comment");
    expect(writeHeadingIndex(doc, toc, fenced as never)).toBe(-1);
  });
});
