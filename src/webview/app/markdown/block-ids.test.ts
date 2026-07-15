import { expect, test } from "bun:test";
import { parseMarkdown } from "@astryxdesign/core/Markdown/utils";
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
