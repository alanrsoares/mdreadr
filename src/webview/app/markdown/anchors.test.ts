import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "@astryxdesign/core/Markdown/utils";
import {
  blockIdForCode,
  blockIdForHeading,
  blockIdForList,
  blockIdForParagraph,
  blockIdForTable,
  extractHeadings,
  type TocEntry,
} from "@mdreadr/domain";
import {
  anchorDisplayLabel,
  collectBlockIds,
  createAnchorPlan,
  partitionReaderSegments,
} from "./anchors.ts";
import { preprocessReaderMarkdown } from "./preprocess.ts";

function findHeading(headings: TocEntry[], text: string): TocEntry {
  const found = headings.find((entry) => entry.text === text);
  if (!found) throw new Error(`Expected a heading entry for "${text}"`);
  return found;
}

test("createAnchorPlan returns stable paragraph ids across instances", () => {
  const markdown = preprocessReaderMarkdown("Alpha\n\nBeta\n\nAlpha again");
  const first = createAnchorPlan(markdown);
  const second = createAnchorPlan(markdown);

  expect(first.nextParagraph("Alpha").blockId).toBe(second.nextParagraph("Alpha").blockId);
  expect(first.nextParagraph("Beta").blockId).toBe(second.nextParagraph("Beta").blockId);
  expect(first.nextParagraph("Alpha again").blockId).toBe(
    second.nextParagraph("Alpha again").blockId,
  );
});

test("createAnchorPlan matches parseMarkdown block order", () => {
  const markdown = preprocessReaderMarkdown("Intro\n\n```ts\nconst x = 1\n```\n\nOutro");
  const plan = createAnchorPlan(markdown);
  const blocks = parseMarkdown(markdown, { autolink: "gfm" });

  const paragraphBlocks = blocks.filter((block) => block.type === "paragraph");
  expect(paragraphBlocks).toHaveLength(2);
  expect(plan.nextParagraph("Intro").blockId).toBeTruthy();
  expect(plan.nextCode("const x = 1", "ts").blockId).toBeTruthy();
  expect(plan.nextParagraph("Outro").blockId).toBeTruthy();
});

test("full-plan order: headings, paragraphs, and code get ids matching direct computation", () => {
  const raw =
    "# Title\n\nIntro paragraph\n\n## Section\n\n```ts\nconst x = 1\n```\n\nOutro paragraph";
  const prepared = preprocessReaderMarkdown(raw);
  const plan = createAnchorPlan(prepared);
  const headings = extractHeadings(prepared);
  const titleEntry = findHeading(headings, "Title");
  const sectionEntry = findHeading(headings, "Section");

  const title = plan.nextHeading(1, "Title");
  expect(title.domId).toBe(blockIdForHeading(titleEntry));
  expect(title.anchor.blockId).toBe(title.domId);

  const intro = plan.nextParagraph("Intro paragraph");
  expect(intro.blockId).toBe(blockIdForParagraph("Intro paragraph", 0));

  const section = plan.nextHeading(2, "Section");
  expect(section.domId).toBe(blockIdForHeading(sectionEntry));

  const code = plan.nextCode("const x = 1", "ts");
  expect(code.blockId).toBe(blockIdForCode("const x = 1", "ts", 0));

  const outro = plan.nextParagraph("Outro paragraph");
  expect(outro.blockId).toBe(blockIdForParagraph("Outro paragraph", 0));
});

test("duplicate paragraphs and code fences get incrementing occurrence ids", () => {
  const raw = "Same text\n\nSame text\n\n```ts\nfoo()\n```\n\n```ts\nfoo()\n```";
  const prepared = preprocessReaderMarkdown(raw);
  const plan = createAnchorPlan(prepared);

  expect(plan.nextParagraph("Same text").blockId).toBe(blockIdForParagraph("Same text", 0));
  expect(plan.nextParagraph("Same text").blockId).toBe(blockIdForParagraph("Same text", 1));

  expect(plan.nextCode("foo()", "ts").blockId).toBe(blockIdForCode("foo()", "ts", 0));
  expect(plan.nextCode("foo()", "ts").blockId).toBe(blockIdForCode("foo()", "ts", 1));
});

// Regression (from WS-3): an `align` fence (rendered by AlignBlock, which
// never touches the plan) used to still consume a slot in the precomputed
// code-id list, shifting every id after it. A `ts` fence following an align
// hero must get the same id whether or not the align fence precedes it.
test("align fences are excluded from the code cursor (align-desync regression)", () => {
  const raw = '<div align="center">\n\n# Hero\n\n</div>\n\n```ts\nconst y = 2\n```';
  const prepared = preprocessReaderMarkdown(raw);
  const plan = createAnchorPlan(prepared);

  const blocks = parseMarkdown(prepared, { autolink: "gfm" });
  const tsBlock = blocks.find(
    (block): block is Extract<(typeof blocks)[number], { type: "codeblock" }> =>
      block.type === "codeblock" && block.language === "ts",
  );
  expect(tsBlock).toBeTruthy();
  const tsCode = tsBlock?.content ?? "";

  // The renderer only calls nextCode for the `ts` fence — the align fence
  // returns early via AlignBlock without ever consuming a plan cursor slot.
  expect(plan.nextCode(tsCode, "ts").blockId).toBe(blockIdForCode(tsCode, "ts", 0));
});

test("lists and tables do not desynchronize paragraph cursors and have their own anchors", () => {
  const raw = [
    "# Document",
    "",
    "Intro paragraph",
    "",
    "- First bullet",
    "- Second bullet",
    "",
    "| Header A | Header B |",
    "| --- | --- |",
    "| Val 1 | Val 2 |",
    "",
    "Outro paragraph",
  ].join("\n");
  const prepared = preprocessReaderMarkdown(raw);
  const plan = createAnchorPlan(prepared);

  expect(plan.nextHeading(1, "Document").domId).toBe("heading-document");
  expect(plan.nextParagraph("Intro paragraph").blockId).toBe(
    blockIdForParagraph("Intro paragraph", 0),
  );
  expect(plan.nextList("First bullet\nSecond bullet").blockId).toBe(
    blockIdForList("First bullet\nSecond bullet", 0),
  );
  expect(plan.nextTable("Header A | Header B\nVal 1 | Val 2").blockId).toBe(
    blockIdForTable("Header A | Header B\nVal 1 | Val 2", 0),
  );
  // Outro paragraph MUST get its own id, not shifted by list items or table!
  expect(plan.nextParagraph("Outro paragraph").blockId).toBe(
    blockIdForParagraph("Outro paragraph", 0),
  );
});

test("partitionReaderSegments splits document around lists and tables", () => {
  const raw = [
    "# Document",
    "",
    "Intro paragraph",
    "",
    "- First bullet",
    "- Second bullet",
    "",
    "Middle paragraph",
    "",
    "| Col 1 | Col 2 |",
    "| --- | --- |",
    "| A | B |",
    "",
    "Final paragraph",
  ].join("\n");

  const segments = partitionReaderSegments(raw);
  expect(segments).toHaveLength(5);
  expect(segments[0]?.kind).toBe("markdown");
  expect(segments[0]?.text).toContain("# Document");
  expect(segments[0]?.text).toContain("Intro paragraph");

  expect(segments[1]?.kind).toBe("list");
  expect(segments[1]?.text).toBe("- First bullet\n- Second bullet");

  expect(segments[2]?.kind).toBe("markdown");
  expect(segments[2]?.text).toBe("Middle paragraph");

  expect(segments[3]?.kind).toBe("table");
  expect(segments[3]?.text).toContain("| Col 1 | Col 2 |");

  expect(segments[4]?.kind).toBe("markdown");
  expect(segments[4]?.text).toBe("Final paragraph");
});

test("begin() resets cursors so a second render pass reproduces identical ids", () => {
  const raw =
    "# A\n\nAlpha\n\nAlpha\n\n## B\n\n```ts\nfoo()\n```\n\n```ts\nfoo()\n```\n\n### C\n\n## D";
  const prepared = preprocessReaderMarkdown(raw);
  const plan = createAnchorPlan(prepared);

  const consumePass = () => [
    plan.nextHeading(1, "A"),
    plan.nextParagraph("Alpha"),
    plan.nextParagraph("Alpha"),
    plan.nextHeading(2, "B"),
    plan.nextCode("foo()", "ts"),
    plan.nextCode("foo()", "ts"),
    plan.nextHeading(3, "C"),
    plan.nextHeading(2, "D"),
  ];

  const first = consumePass();
  plan.begin();
  const second = consumePass();

  expect(second).toEqual(first);
});

test("desync fallback: extra paragraph beyond the document falls back without throwing", () => {
  const prepared = preprocessReaderMarkdown("Alpha");
  const plan = createAnchorPlan(prepared);

  plan.nextParagraph("Alpha");

  expect(() => {
    const extra = plan.nextParagraph("Never appeared in the document");
    expect(extra.blockId).toBe(blockIdForParagraph("Never appeared in the document", 0));
  }).not.toThrow();
});

test("heading paths track the current stack across levels", () => {
  const raw = "# A\n\n## B\n\n### C\n\n## D";
  const prepared = preprocessReaderMarkdown(raw);
  const plan = createAnchorPlan(prepared);

  expect(plan.nextHeading(1, "A").anchor.headingPath).toEqual(["A"]);
  expect(plan.nextHeading(2, "B").anchor.headingPath).toEqual(["A", "B"]);
  expect(plan.nextHeading(3, "C").anchor.headingPath).toEqual(["A", "B", "C"]);
  expect(plan.nextHeading(2, "D").anchor.headingPath).toEqual(["A", "D"]);
});

describe("anchorDisplayLabel", () => {
  test("label wins over headingPath and kind", () => {
    expect(
      anchorDisplayLabel({
        kind: "paragraph",
        blockId: "x",
        label: "My label",
        headingPath: ["A", "B"],
      }),
    ).toBe("My label");
  });

  test("falls back to the heading path when there is no label", () => {
    expect(
      anchorDisplayLabel({
        kind: "heading",
        blockId: "x",
        headingPath: ["A", "B"],
      }),
    ).toBe("A › B");
  });

  test("falls back to kind when there is neither label nor headingPath", () => {
    expect(anchorDisplayLabel({ kind: "code", blockId: "x" })).toBe("code");
  });
});

describe("collectBlockIds", () => {
  const doc = ["# Title", "", "First paragraph.", "", "```ts", "const a = 1;", "```"].join("\n");

  test("covers headings, paragraphs and code blocks", () => {
    const ids = collectBlockIds(preprocessReaderMarkdown(doc));
    const plan = createAnchorPlan(preprocessReaderMarkdown(doc));

    expect(ids.has(plan.nextHeading(1, "Title").domId)).toBe(true);
    expect(ids.has(plan.nextParagraph("First paragraph.").blockId)).toBe(true);
    expect(ids.has(plan.nextCode("const a = 1;\n", "ts").blockId)).toBe(true);
  });

  test("an edited paragraph is the only id that differs across revisions", () => {
    const edited = doc.replace("First paragraph.", "First paragraph, revised.");

    const before = collectBlockIds(preprocessReaderMarkdown(doc));
    const after = collectBlockIds(preprocessReaderMarkdown(edited));
    const added = [...after].filter((id) => !before.has(id));

    expect(added).toHaveLength(1);
    const plan = createAnchorPlan(preprocessReaderMarkdown(edited));
    plan.nextHeading(1, "Title");
    expect(added[0]).toBe(plan.nextParagraph("First paragraph, revised.").blockId);
  });

  test("an untouched revision has no changed ids", () => {
    const before = collectBlockIds(preprocessReaderMarkdown(doc));
    const after = collectBlockIds(preprocessReaderMarkdown(doc));

    expect([...after].filter((id) => !before.has(id))).toEqual([]);
  });
});
