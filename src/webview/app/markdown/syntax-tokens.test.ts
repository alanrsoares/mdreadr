import { describe, expect, test } from "bun:test";
import { isNone, isSome, unwrapOr } from "@onrails/maybe";
import { resolveGrammar, type SyntaxToken, syntaxTokenizer } from "./syntax-tokens.ts";

const sliceOf = (code: string, token: SyntaxToken) => code.slice(token.start, token.end);

const typeOfSlice = (code: string, tokens: SyntaxToken[], text: string) =>
  tokens.find((token) => sliceOf(code, token) === text)?.type;

describe("resolveGrammar", () => {
  test("passes through a grammar refractor already knows", () => {
    expect(unwrapOr(resolveGrammar("rust"), "")).toBe("rust");
  });

  test("maps the aliases people actually type in fences", () => {
    expect(unwrapOr(resolveGrammar("ts"), "")).toBe("typescript");
    expect(unwrapOr(resolveGrammar("Dockerfile"), "")).toBe("docker");
    expect(unwrapOr(resolveGrammar(" HTML "), "")).toBe("markup");
  });

  test("registers the grammars missing from the common bundle", () => {
    for (const language of ["tsx", "jsx", "toml", "graphql", "docker"]) {
      expect(isSome(resolveGrammar(language))).toBe(true);
    }
  });

  test("is none for a missing or unknown language", () => {
    expect(isNone(resolveGrammar(undefined))).toBe(true);
    expect(isNone(resolveGrammar("not-a-language"))).toBe(true);
  });
});

describe("syntaxTokenizer", () => {
  test("highlights languages the bare CodeBlock cannot", () => {
    const code = `fn main() {\n    let x = 42;\n}`;
    const tokens = syntaxTokenizer(code, "rust");

    expect(typeOfSlice(code, tokens, "fn")).toBe("keyword");
    expect(typeOfSlice(code, tokens, "42")).toBe("number");
    expect(typeOfSlice(code, tokens, "main")).toBe("function");
  });

  test("returns ranges that are ordered, non-overlapping and in bounds", () => {
    const code = `SELECT name FROM users -- a comment\nWHERE id = 7;`;
    const tokens = syntaxTokenizer(code, "sql");

    expect(tokens.length).toBeGreaterThan(0);

    let previousEnd = 0;
    for (const token of tokens) {
      expect(token.start).toBeGreaterThanOrEqual(previousEnd);
      expect(token.end).toBeGreaterThan(token.start);
      expect(token.end).toBeLessThanOrEqual(code.length);
      previousEnd = token.end;
    }
  });

  test("covers only the token text, never surrounding whitespace", () => {
    const code = `const value = "hello"`;
    const tokens = syntaxTokenizer(code, "typescript");

    for (const token of tokens) {
      expect(sliceOf(code, token)).toBe(sliceOf(code, token).trim());
    }
    expect(typeOfSlice(code, tokens, '"hello"')).toBe("string");
  });

  test("attributes text to the innermost token that wraps it", () => {
    const code = `<a href="x">hi</a>`;
    const tokens = syntaxTokenizer(code, "html");

    // `href` sits inside a `tag` element; the inner attr-name must win.
    expect(typeOfSlice(code, tokens, "href")).toBe("attribute");
  });

  test("leaves a fence plain when the language is unknown or absent", () => {
    expect(syntaxTokenizer("whatever", "not-a-language")).toEqual([]);
    expect(syntaxTokenizer("whatever", undefined)).toEqual([]);
  });

  test("skips a pathologically large fence instead of blocking render", () => {
    expect(syntaxTokenizer("const x = 1;\n".repeat(20_000), "typescript")).toEqual([]);
  });
});
