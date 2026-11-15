import { describe, expect, it } from "bun:test";
import {
  blockIndexAtOffset,
  frontmatterLength,
  markdownBody,
  spliceMarkdown,
  splitSourceBlocks,
} from "./splice.ts";

const texts = (markdown: string): string[] => splitSourceBlocks(markdown).map((b) => b.text);

describe("splitSourceBlocks", () => {
  it("splits on blank lines", () => {
    expect(texts("one\n\ntwo\nstill two\n\n\nthree\n")).toEqual(["one", "two\nstill two", "three"]);
  });

  it("keeps a fence whole across blank lines", () => {
    const fence = "```ts\nconst a = 1;\n\nconst b = 2;\n```";
    expect(texts(`before\n\n${fence}\n\nafter`)).toEqual(["before", fence, "after"]);
  });

  it("ends an unclosed fence at the end of the document", () => {
    expect(texts("```\nabc\n\ndef")).toEqual(["```\nabc\n\ndef"]);
  });

  it("breaks a heading, a rule and a fence out of adjacent lines", () => {
    expect(texts("text\n# Head\nmore\n---\n```\nx\n```")).toEqual([
      "text",
      "# Head",
      "more",
      "---",
      "```\nx\n```",
    ]);
  });

  it("keeps a loose list in one block", () => {
    expect(texts("- a\n\n- b\n\n  continued\n\npara")).toEqual([
      "- a\n\n- b\n\n  continued",
      "para",
    ]);
  });

  it("keeps nested and task items in the list", () => {
    expect(texts("- a\n    - b\n- [ ] c\n- [x] d")).toEqual(["- a\n    - b\n- [ ] c\n- [x] d"]);
  });

  it("separates a list from the paragraph above it", () => {
    expect(texts("intro\n- a\n- b")).toEqual(["intro", "- a\n- b"]);
  });

  it("keeps a quote and a table whole", () => {
    expect(texts("> a\n> b\n\n| h |\n| - |\n| c |")).toEqual(["> a\n> b", "| h |\n| - |\n| c |"]);
  });

  it("skips front matter", () => {
    expect(texts("---\ntitle: x\n---\n\n# Hi")).toEqual(["# Hi"]);
    expect(frontmatterLength("---\ntitle: x\n---\n\n# Hi")).toBe("---\ntitle: x\n---\n".length);
    expect(markdownBody("---\na: b\n---\ntext")).toBe("text");
  });

  it("reports offsets into the full string", () => {
    const source = "one\n\ntwo";
    const [first, second] = splitSourceBlocks(source);
    expect(source.slice(first?.start, first?.end)).toBe("one");
    expect(source.slice(second?.start, second?.end)).toBe("two");
    expect(blockIndexAtOffset(splitSourceBlocks(source), 6)).toBe(1);
    expect(blockIndexAtOffset(splitSourceBlocks(source), 1)).toBe(0);
  });
});

describe("spliceMarkdown", () => {
  // Deliberately not what the editor would write: star bullets, padded table.
  const original = [
    "---",
    "title: keep me",
    "---",
    "",
    "# Title",
    "",
    "First *paragraph*.",
    "",
    "* a",
    "* b",
    "",
    "| a   | b   |",
    "| --- | :-: |",
    "| 1   | 2   |",
    "",
    "Last one.",
    "",
  ].join("\n");

  const baseline = [
    "# Title",
    "",
    "First *paragraph*.",
    "",
    "- a",
    "- b",
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "Last one.",
  ].join("\n");

  it("returns the original untouched when nothing changed", () => {
    expect(spliceMarkdown(original, baseline, baseline)).toBe(original);
  });

  it("rewrites only the changed block", () => {
    const next = baseline.replace("First *paragraph*.", "First edited paragraph.");
    const result = spliceMarkdown(original, baseline, next);
    expect(result).toBe(original.replace("First *paragraph*.", "First edited paragraph."));
    expect(result).toContain("* a\n* b");
    expect(result).toContain("| a   | b   |");
  });

  it("edits several blocks in place", () => {
    const next = baseline.replace("# Title", "# New").replace("Last one.", "Final.");
    const result = spliceMarkdown(original, baseline, next);
    expect(result).toBe(original.replace("# Title", "# New").replace("Last one.", "Final."));
  });

  it("inserts a block in the middle with one blank line around it", () => {
    const next = baseline.replace("First *paragraph*.", "First *paragraph*.\n\nInserted.");
    const result = spliceMarkdown(original, baseline, next);
    expect(result).toBe(original.replace("First *paragraph*.", "First *paragraph*.\n\nInserted."));
  });

  it("inserts at the start and the end", () => {
    const atStart = spliceMarkdown(original, baseline, `Intro.\n\n${baseline}`);
    expect(atStart).toBe(original.replace("# Title", "Intro.\n\n# Title"));

    const atEnd = spliceMarkdown(original, baseline, `${baseline}\n\nOutro.`);
    expect(atEnd).toBe(original.replace("Last one.", "Last one.\n\nOutro."));
  });

  it("deletes a block from the middle, the start and the end", () => {
    const middle = baseline.replace("First *paragraph*.\n\n", "");
    expect(spliceMarkdown(original, baseline, middle)).toBe(
      original.replace("First *paragraph*.\n\n", ""),
    );

    const start = baseline.replace("# Title\n\n", "");
    expect(spliceMarkdown(original, baseline, start)).toBe(original.replace("# Title\n\n", ""));

    const end = baseline.replace("\n\nLast one.", "");
    expect(spliceMarkdown(original, baseline, end)).toBe(original.replace("\n\nLast one.", ""));
  });

  it("replaces a run when the block count changes in the middle", () => {
    const next = baseline.replace("- a\n- b", "- a\n- b\n- c\n\nSplit off.");
    const result = spliceMarkdown(original, baseline, next);
    expect(result).toContain("- a\n- b\n- c\n\nSplit off.");
    expect(result).toContain("title: keep me");
    expect(result).toContain("| a   | b   |");
    expect(result.endsWith("Last one.\n")).toBe(true);
  });

  it("keeps front matter and the trailing newline", () => {
    const next = baseline.replace("# Title", "# T2");
    const result = spliceMarkdown(original, baseline, next);
    expect(result.startsWith("---\ntitle: keep me\n---\n")).toBe(true);
    expect(result.endsWith("\n")).toBe(true);
  });

  it("keeps CRLF line endings outside the changed block", () => {
    const crlf = "one\r\n\r\ntwo\r\n\r\nthree\r\n";
    const result = spliceMarkdown(crlf, "one\n\ntwo\n\nthree", "one\n\nTWO\n\nthree");
    expect(result).toBe("one\r\n\r\nTWO\r\n\r\nthree\r\n");
  });

  it("falls back to the editor's markdown when the structure does not line up", () => {
    // The splitter finds 2 blocks in the original, the editor's baseline has 1.
    const result = spliceMarkdown("a\n\nb\n", "a b", "a c");
    expect(result).toBe("a c\n");
  });

  it("handles a Document with no blocks", () => {
    expect(spliceMarkdown("", "", "New.")).toBe("New.");
  });
});
