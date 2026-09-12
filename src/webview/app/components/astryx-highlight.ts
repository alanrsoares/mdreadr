import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { syntaxColor } from "../theme/syntax-slots.ts";

/**
 * Lezer tag -> astryx slot, the editor's half of the contract the reader's
 * `syntax-tokens` holds for Prism. Without it the editor borrows CodeMirror's
 * own palettes (`oneDark` in the dark, `defaultHighlightStyle` in the light)
 * and the same snippet changes colour when you switch between reading and
 * editing it.
 *
 * Tags inherit: styling `name` also styles `variableName` and `labelName`,
 * so only the children that land on a *different* slot are listed. Anything
 * absent falls back to the surrounding text colour, the same way an unmapped
 * Prism class does in the reader.
 */
const codeTags = [
  { tag: tags.comment, slot: "comment" },
  { tag: tags.keyword, slot: "keyword" },
  // `null`, `atom` and `bool` hang off `keyword`/`literal` in Lezer but read
  // as values, which is where Prism's `boolean` lands too.
  { tag: [tags.null, tags.atom, tags.bool, tags.unit, tags.color, tags.escape], slot: "constant" },
  { tag: tags.string, slot: "string" },
  { tag: [tags.regexp, tags.url], slot: "string" },
  { tag: tags.number, slot: "number" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], slot: "function" },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.macroName], slot: "type" },
  { tag: tags.name, slot: "variable" },
  { tag: tags.propertyName, slot: "property" },
  { tag: tags.attributeName, slot: "attribute" },
  { tag: tags.tagName, slot: "tag" },
  { tag: tags.operator, slot: "operator" },
  // `meta` carries the markers a markup grammar emits — the `#` of a heading,
  // the fence of a code block — which belong with the other punctuation.
  { tag: [tags.punctuation, tags.meta], slot: "punctuation" },
] as const;

/**
 * Prose has no slot in a code palette: astryx gives colours to tokens, not to
 * headings. These carry the weight, slant and rule the reader renders them
 * with instead, so markdown source still reads as marked-up prose.
 */
const proseTags = [
  { tag: tags.heading, color: "var(--color-text-primary)", fontWeight: "bold" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--color-text-accent)", textDecoration: "underline" },
  { tag: tags.monospace, fontFamily: "var(--font-family-code)" },
  { tag: tags.quote, color: "var(--color-text-secondary)" },
  { tag: tags.invalid, color: "var(--color-text-red)" },
  { tag: tags.inserted, color: "var(--color-text-green)" },
  { tag: tags.deleted, color: "var(--color-text-red)" },
  { tag: tags.changed, color: "var(--color-text-yellow)" },
];

/**
 * One style for both colour schemes: every custom property behind it is a
 * `light-dark()` pair, so the theme switch repaints without a second
 * `HighlightStyle` and without re-creating the editor's extensions.
 */
export const astryxHighlightStyle = HighlightStyle.define([
  ...codeTags.map(({ tag, slot }) => ({ tag, color: syntaxColor(slot) })),
  ...proseTags,
]);
