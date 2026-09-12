import { flatMap, fromNullable, isSome, type Maybe } from "@onrails/maybe";
import type { Element, RootContent } from "hast";
import { refractor } from "refractor";
import docker from "refractor/docker";
import graphql from "refractor/graphql";
import jsx from "refractor/jsx";
import toml from "refractor/toml";
import tsx from "refractor/tsx";

// `refractor` (the common bundle) ships the ~36 grammars that cover almost
// every fence in real docs. These five are missing from it but show up
// constantly in READMEs, so they are registered up front. Everything else
// falls through to an unhighlighted block rather than guessing a grammar.
for (const syntax of [jsx, tsx, toml, docker, graphql]) refractor.register(syntax);

/** The 14-slot contract astryx's CodeBlock paints (minus `background`). */
export type SyntaxSlot =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "function"
  | "type"
  | "variable"
  | "operator"
  | "constant"
  | "tag"
  | "attribute"
  | "property"
  | "punctuation";

export type SyntaxToken = { type: SyntaxSlot; start: number; end: number };

/**
 * Prism token class -> astryx slot. Prism emits a long tail of grammar-specific
 * classes; anything absent here is deliberately dropped (rendered as plain
 * text) instead of being mapped to a plausible-looking colour.
 */
const slotByPrismToken: Record<string, SyntaxSlot> = {
  atrule: "keyword",
  directive: "keyword",
  important: "keyword",
  keyword: "keyword",
  rule: "keyword",
  "attr-value": "string",
  char: "string",
  regex: "string",
  string: "string",
  "template-string": "string",
  url: "string",
  cdata: "comment",
  comment: "comment",
  doctype: "comment",
  prolog: "comment",
  number: "number",
  function: "function",
  method: "function",
  builtin: "type",
  "class-name": "type",
  generic: "type",
  interface: "type",
  namespace: "type",
  entity: "variable",
  parameter: "variable",
  symbol: "variable",
  variable: "variable",
  arrow: "operator",
  operator: "operator",
  boolean: "constant",
  constant: "constant",
  selector: "tag",
  tag: "tag",
  "attr-name": "attribute",
  key: "property",
  property: "property",
  delimiter: "punctuation",
  punctuation: "punctuation",
};

/** Fence languages people actually type -> the grammar refractor knows. */
const grammarByAlias: Record<string, string> = {
  "c++": "cpp",
  cs: "csharp",
  dockerfile: "docker",
  gql: "graphql",
  htm: "markup",
  html: "markup",
  js: "javascript",
  kt: "kotlin",
  md: "markdown",
  mjs: "javascript",
  objc: "objectivec",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  svg: "markup",
  ts: "typescript",
  vue: "markup",
  xml: "markup",
  yml: "yaml",
  zsh: "bash",
};

/**
 * Tokenizing runs synchronously inside render (astryx only defers its own
 * tokenizer), so a pathological fence is left plain rather than blocking paint.
 */
const MAX_HIGHLIGHTED_CHARS = 100_000;

/** The grammar to highlight `language` with, if we have one registered. */
export function resolveGrammar(language: string | undefined): Maybe<string> {
  return flatMap(fromNullable(language), (value) => {
    const requested = value.trim().toLowerCase();
    const grammar = grammarByAlias[requested] ?? requested;
    return fromNullable(refractor.registered(grammar) ? grammar : null);
  });
}

/** Depth-first walk; text is attributed to the innermost token that wraps it. */
function collectTokens(
  nodes: readonly RootContent[],
  slot: SyntaxSlot | null,
  cursor: number,
  out: SyntaxToken[],
): number {
  let offset = cursor;

  for (const node of nodes) {
    if (node.type === "text") {
      if (slot !== null && node.value.length > 0) {
        out.push({ type: slot, start: offset, end: offset + node.value.length });
      }
      offset += node.value.length;
      continue;
    }
    if (node.type !== "element") continue;
    offset = collectTokens(node.children, slotForElement(node) ?? slot, offset, out);
  }

  return offset;
}

/** Prism stacks classes as `token <type> <alias>`; the first mapped one wins. */
function slotForElement(element: Element): SyntaxSlot | null {
  const classNames = element.properties?.className;
  if (!Array.isArray(classNames)) return null;

  for (const className of classNames) {
    const slot = slotByPrismToken[String(className)];
    if (slot !== undefined) return slot;
  }

  return null;
}

/**
 * Flat, non-overlapping, absolute-offset tokens for astryx's `tokenizer` prop.
 * Must stay a module-level function: CodeBlock keys its token memo on the
 * callback identity, so an inline lambda would re-tokenize every render.
 */
export function syntaxTokenizer(code: string, language: string | undefined): SyntaxToken[] {
  if (code.length > MAX_HIGHLIGHTED_CHARS) return [];

  const grammar = resolveGrammar(language);
  if (!isSome(grammar)) return [];

  const tokens: SyntaxToken[] = [];
  collectTokens(refractor.highlight(code, grammar.value).children, null, 0, tokens);

  return tokens;
}
