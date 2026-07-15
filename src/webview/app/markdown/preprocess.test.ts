import { expect, test } from "bun:test";
import { parseMarkdown } from "@astryxdesign/core/Markdown/utils";
import { preprocessReaderMarkdown } from "./preprocess.ts";

test("preprocessReaderMarkdown converts block math", () => {
  const input = "Intro\n\n$$E = mc^2$$\n\nOutro";
  expect(preprocessReaderMarkdown(input)).toContain("```math\nE = mc^2\n```");
});

test("preprocessReaderMarkdown converts GitHub alerts", () => {
  const input = "> [!NOTE]\n> Body";
  expect(preprocessReaderMarkdown(input)).toBe("> **Note**\n> Body");
});

test("preprocessReaderMarkdown converts linked badge images", () => {
  const input =
    "[![NPM Version](https://img.shields.io/npm/v/foo?color=green)](https://www.npmjs.com/package/foo)";
  const result = preprocessReaderMarkdown(input);
  expect(result).toContain("```badges");
  expect(result).toContain('"alt":"NPM Version"');
});

test("preprocessReaderMarkdown merges consecutive badge lines into one block", () => {
  const input = `[![A](https://img.shields.io/a)](https://example.com/a)
[![B](https://img.shields.io/b)](https://example.com/b)`;
  const result = preprocessReaderMarkdown(input);
  expect(result).toMatch(/^```badges/m);
  expect(result.match(/"alt":"A"/g)).toHaveLength(1);
  expect(result.match(/"alt":"B"/g)).toHaveLength(1);
});

test("preprocessReaderMarkdown parses badge blocks for Astryx", () => {
  const input = `[![A](https://img.shields.io/a)](https://example.com/a)
[![B](https://img.shields.io/b)](https://example.com/b)`;
  const blocks = parseMarkdown(preprocessReaderMarkdown(input));
  expect(blocks[0]?.type).toBe("codeblock");
  if (blocks[0]?.type === "codeblock") {
    expect(blocks[0].language).toBe("badges");
  }
});

test("preprocessReaderMarkdown leaves linked badges inside code fences", () => {
  const input = "```md\n[![A](https://img.shields.io/a)](https://example.com)\n```";
  expect(preprocessReaderMarkdown(input)).toBe(input);
});
