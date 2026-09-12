/**
 * The palette astryx paints code with. Both code surfaces resolve to these
 * slots — the reader through refractor's Prism classes, the editor through
 * Lezer's tags — so a keyword is the same colour wherever it is read.
 */
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

/** The theme's custom property for a slot, for somewhere CSS classes cannot reach. */
export const syntaxColor = (slot: SyntaxSlot): string => `var(--color-syntax-${slot})`;
