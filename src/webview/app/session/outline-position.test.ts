import { describe, expect, it } from "bun:test";
import type { TocEntry } from "@mdreadr/domain";
import { outlineIdAtLine } from "./outline-position.ts";

const entries: TocEntry[] = [
  { id: "title", level: 1, text: "Title", line: 0 },
  { id: "one", level: 2, text: "One", line: 10 },
  { id: "two", level: 2, text: "Two", line: 20 },
];

describe("outlineIdAtLine", () => {
  it("returns the heading the line sits under", () => {
    expect(outlineIdAtLine(entries, 15)).toBe("heading-one");
    expect(outlineIdAtLine(entries, 999)).toBe("heading-two");
  });

  it("activates a heading on its own line", () => {
    expect(outlineIdAtLine(entries, 20)).toBe("heading-two");
  });

  it("has nothing active above the first heading", () => {
    const belowFirst: TocEntry[] = [{ id: "one", level: 2, text: "One", line: 4 }];
    expect(outlineIdAtLine(belowFirst, 0)).toBeUndefined();
  });

  it("has nothing active in a document with no headings", () => {
    expect(outlineIdAtLine([], 3)).toBeUndefined();
  });
});
