import { describe, expect, test } from "bun:test";
import { javascriptLanguage } from "@codemirror/lang-javascript";
import { markdownLanguage } from "@codemirror/lang-markdown";
import type { Language } from "@codemirror/language";
import { highlightTree } from "@lezer/highlight";
import { astryxHighlightStyle } from "./astryx-highlight.ts";

const rules = (): string => astryxHighlightStyle.module?.getRules() ?? "";

/** The declarations the style ends up applying to the token covering `text`. */
function declarationsFor(language: Language, code: string, text: string): string {
  const start = code.indexOf(text);
  expect(start).toBeGreaterThanOrEqual(0);

  const classNames: string[] = [];
  highlightTree(language.parser.parse(code), astryxHighlightStyle, (from, to, classes) => {
    if (from <= start && to >= start + text.length) classNames.push(...classes.split(" "));
  });

  return classNames
    .map((className) => rules().split(`.${className} {`)[1]?.split("}")[0] ?? "")
    .join(" ");
}

describe("code tokens resolve to astryx slots", () => {
  const code = "const total = 1; // sum\nfunction add(x) { return 'a'; }";

  test.each([
    ["const", "keyword"],
    ["total", "variable"],
    ["1", "number"],
    ["// sum", "comment"],
    ["'a'", "string"],
    ["add", "function"],
  ])("%s paints with the %s slot", (text, slot) => {
    expect(declarationsFor(javascriptLanguage, code, text)).toContain(
      `color: var(--color-syntax-${slot});`,
    );
  });

  test("no colour is hard-coded past the theme", () => {
    const colors = [...rules().matchAll(/color: ([^;]+);/g)].map((match) => match[1]);
    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) expect(color).toMatch(/^var\(--color-/);
  });
});

describe("markdown prose keeps its shape", () => {
  test("a heading is bold", () => {
    expect(declarationsFor(markdownLanguage, "# Title\n", "Title")).toContain("font-weight: bold;");
  });

  test("emphasis is slanted, and takes no colour of its own", () => {
    const declarations = declarationsFor(markdownLanguage, "text *lean* here\n", "lean");
    expect(declarations).toContain("font-style: italic;");
    expect(declarations).not.toContain("color:");
  });

  test("a heading marker is punctuation, so the prose stays the loud part", () => {
    expect(declarationsFor(markdownLanguage, "# Title\n", "#")).toContain(
      "color: var(--color-syntax-punctuation);",
    );
  });
});
