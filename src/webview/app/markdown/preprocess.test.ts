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

test("preprocessReaderMarkdown strips HTML comments", () => {
  const input = "Before\n\n<!-- hidden\nnote -->\n\nAfter";
  const result = preprocessReaderMarkdown(input);
  expect(result).not.toContain("hidden");
  expect(result).toContain("Before");
  expect(result).toContain("After");
});

test("preprocessReaderMarkdown keeps HTML comments inside code", () => {
  const fenced = "```html\n<!-- keep -->\n```";
  expect(preprocessReaderMarkdown(fenced)).toBe(fenced);
  expect(preprocessReaderMarkdown("Use `<!-- keep -->` syntax")).toContain("<!-- keep -->");
});

test("preprocessReaderMarkdown converts align wrappers to fences", () => {
  const input = '<div align="center">\n\n# Hero\n\n</div>';
  const blocks = parseMarkdown(preprocessReaderMarkdown(input));
  expect(blocks[0]?.type).toBe("codeblock");
  if (blocks[0]?.type === "codeblock") {
    expect(blocks[0].language).toBe("align");
    expect(JSON.parse(blocks[0].content)).toEqual({ align: "center", body: "# Hero" });
  }
});

test("preprocessReaderMarkdown leaves align wrappers with fenced bodies alone", () => {
  const input = '<p align="right">\n```js\nconst x = 1;\n```\n</p>';
  expect(preprocessReaderMarkdown(input)).toBe(input);
});

test("preprocessReaderMarkdown ignores align values outside the allowlist", () => {
  const input = '<div align="justify">text</div>';
  expect(preprocessReaderMarkdown(input)).toBe(input);
});

test("preprocessReaderMarkdown keeps align payload valid JSON when body has badges", () => {
  const input = [
    '<div align="center">',
    "",
    "# Ganymede",
    "",
    "**A deterministic WebGPU space autobattler.**",
    "",
    "[![Play](https://img.shields.io/badge/play-live-3fd8ff)](https://example.com/play)",
    "[![Bun](https://img.shields.io/badge/Bun-1.3-fbf0df)](https://bun.com)",
    "",
    '<img src="docs/hero.png" alt="Hero" width="820" />',
    "",
    "</div>",
  ].join("\n");

  const blocks = parseMarkdown(preprocessReaderMarkdown(input));
  expect(blocks[0]?.type).toBe("codeblock");
  if (blocks[0]?.type === "codeblock") {
    expect(blocks[0].language).toBe("align");
    const payload = JSON.parse(blocks[0].content) as { align: string; body: string };
    expect(payload.align).toBe("center");
    expect(payload.body).toContain("# Ganymede");
    expect(payload.body).toContain("```badges");
    expect(payload.body).toContain('<img src="docs/hero.png"');
  }
});

test("preprocessReaderMarkdown decodes non-breaking spaces outside code", () => {
  expect(preprocessReaderMarkdown("a&nbsp;b")).toBe("a b");
  expect(preprocessReaderMarkdown("`a&nbsp;b`")).toBe("`a&nbsp;b`");
});
