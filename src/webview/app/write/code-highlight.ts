import { type SyntaxSlot, syntaxTokenizer } from "../markdown/syntax-tokens.ts";

/** A run of code text and the astryx slot it is painted with, if any. */
export type CodeSegment = { text: string; slot: SyntaxSlot | null };

/**
 * Splits `code` into runs by the reader's own tokenizer, so a fence is
 * coloured by the same grammar and the same slots in Write as in Preview. The
 * runs always concatenate back to `code`.
 */
export function highlightSegments(code: string, language: string | undefined): CodeSegment[] {
  const segments: CodeSegment[] = [];
  let cursor = 0;

  for (const token of syntaxTokenizer(code, language)) {
    if (token.start > cursor) segments.push({ text: code.slice(cursor, token.start), slot: null });
    segments.push({ text: code.slice(token.start, token.end), slot: token.type });
    cursor = token.end;
  }
  if (cursor < code.length) segments.push({ text: code.slice(cursor), slot: null });

  return segments;
}

/** The theme class for a slot; the stylesheet paints it with `--color-syntax-<slot>`. */
export const slotClass = (slot: SyntaxSlot): string => `write-tok-${slot}`;
