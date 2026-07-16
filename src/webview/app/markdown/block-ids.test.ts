import { expect, test } from "bun:test";
import { parseMarkdown } from "@astryxdesign/core/Markdown/utils";
import { blockIdForCode } from "@mdreadr/domain";
import { createBlockIdAllocator } from "./block-ids.ts";
import { preprocessReaderMarkdown } from "./preprocess.ts";

test("createBlockIdAllocator returns stable paragraph ids across calls", () => {
  const markdown = preprocessReaderMarkdown("Alpha\n\nBeta\n\nAlpha again");
  const first = createBlockIdAllocator(markdown);
  const second = createBlockIdAllocator(markdown);

  expect(first.nextParagraphId("Alpha")).toBe(second.nextParagraphId("Alpha"));
  expect(first.nextParagraphId("Beta")).toBe(second.nextParagraphId("Beta"));
  expect(first.nextParagraphId("Alpha again")).toBe(second.nextParagraphId("Alpha again"));
});

test("createBlockIdAllocator matches parseMarkdown block order", () => {
  const markdown = preprocessReaderMarkdown("Intro\n\n```ts\nconst x = 1\n```\n\nOutro");
  const allocator = createBlockIdAllocator(markdown);
  const blocks = parseMarkdown(markdown, { autolink: "gfm" });

  const paragraphBlocks = blocks.filter((block) => block.type === "paragraph");
  expect(paragraphBlocks).toHaveLength(2);
  expect(allocator.nextParagraphId("Intro")).toBeTruthy();
  expect(allocator.nextCodeId("const x = 1", "ts")).toBeTruthy();
  expect(allocator.nextParagraphId("Outro")).toBeTruthy();
});

// Regression: an `align` fence (rendered by AlignBlock, which never touches
// the allocator) used to still consume a slot in the precomputed code-id
// list, shifting every id after it. A `ts` fence following an align hero
// must therefore get the same id whether or not the align fence precedes it.
test("createBlockIdAllocator excludes align fences from pinnable code (align-desync regression)", () => {
  const raw = '<div align="center">\n\n# Hero\n\n</div>\n\n```ts\nconst y = 2\n```';
  const prepared = preprocessReaderMarkdown(raw);
  const allocator = createBlockIdAllocator(prepared);

  const blocks = parseMarkdown(prepared, { autolink: "gfm" });
  const tsBlock = blocks.find(
    (block): block is Extract<(typeof blocks)[number], { type: "codeblock" }> =>
      block.type === "codeblock" && block.language === "ts",
  );
  expect(tsBlock).toBeTruthy();
  const tsCode = tsBlock?.content ?? "";

  // The renderer only calls nextCodeId for the `ts` fence — the align fence
  // returns early via AlignBlock without ever consuming an allocator slot.
  expect(allocator.nextCodeId(tsCode, "ts")).toBe(blockIdForCode(tsCode, "ts", 0));
});
