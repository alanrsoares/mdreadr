/**
 * Write mode edits a normalized copy of the Document, never the Document
 * itself. The Draft stays the markdown string; when the editor reports a change,
 * only the top-level blocks whose normalized form changed are rewritten, and
 * they are spliced into the original text. Everything the reader did not touch
 * keeps its bytes: bullet characters, table padding, escapes, trailing newline.
 *
 * This module is the pure half of that. It never sees an editor: it is handed
 * the markdown the editor produced when it opened (`baseline`) and the markdown
 * it produces now (`next`), and works on blocks found by `splitSourceBlocks`,
 * the same splitter for all three strings.
 */

export type SourceBlock = {
  /** Offset of the block's first character in the full string. */
  start: number;
  /** Offset just past the block's last character, excluding its line ending. */
  end: number;
  text: string;
};

const FRONTMATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST_ITEM = /^[ \t]*(?:[-*+]|\d+[.)])(?:[ \t]|$)/;
const QUOTE = /^[ \t]*>/;
const TABLE_ROW = /^[ \t]*\|/;
const INDENTED = /^(?: {2,}|\t)/;

type BlockKind = "paragraph" | "list" | "quote" | "table" | "single";
type OpenBlock = { kind: BlockKind; first: number; last: number };

const isBlank = (line: string): boolean => line.trim() === "";

/** Length of a leading `---` front matter block, which Write mode never edits. */
export const frontmatterLength = (markdown: string): number =>
  FRONTMATTER.exec(markdown)?.[0].length ?? 0;

type Line = { text: string; start: number };

function toLines(markdown: string, from: number): Line[] {
  const lines: Line[] = [];
  let start = from;
  while (start <= markdown.length) {
    const newline = markdown.indexOf("\n", start);
    const end = newline === -1 ? markdown.length : newline;
    lines.push({ text: markdown.slice(start, end).replace(/\r$/, ""), start });
    if (newline === -1) break;
    start = newline + 1;
  }
  return lines;
}

/** Index of the line that closes the fence opened at `open`, or the last line. */
function fenceEnd(lines: readonly Line[], open: number, marker: string): number {
  const char = marker[0];
  for (let index = open + 1; index < lines.length; index += 1) {
    const text = lines[index]?.text.trim() ?? "";
    if (text.length >= marker.length && [...text].every((c) => c === char)) return index;
  }
  return lines.length - 1;
}

/**
 * The top-level blocks of a markdown string, in order: what a reader would call
 * a paragraph, a heading, a list, a quote, a table, a fence, a rule. Blank lines
 * separate blocks, except inside a fence and between the items of a loose list.
 * Front matter is not a block.
 */
export function splitSourceBlocks(markdown: string): SourceBlock[] {
  const lines = toLines(markdown, frontmatterLength(markdown));
  const blocks: SourceBlock[] = [];
  // Boxed so the helpers below can reassign it and the loop still sees it.
  const state: { open: OpenBlock | null } = { open: null };

  const close = () => {
    const { open } = state;
    if (!open) return;
    const first = lines[open.first];
    const last = lines[open.last];
    if (first && last) {
      const end = last.start + last.text.length;
      blocks.push({ start: first.start, end, text: markdown.slice(first.start, end) });
    }
    state.open = null;
  };

  const begin = (kind: BlockKind, index: number, last = index) => {
    close();
    state.open = { kind, first: index, last };
  };

  const nextNonBlank = (from: number): string | undefined =>
    lines.slice(from).find((line) => !isBlank(line.text))?.text;

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]?.text ?? "";

    if (isBlank(text)) {
      // A loose list keeps going across a blank line when an item or an
      // indented continuation follows it.
      const upcoming = nextNonBlank(index + 1);
      const continuesList =
        state.open?.kind === "list" &&
        upcoming !== undefined &&
        (LIST_ITEM.test(upcoming) || INDENTED.test(upcoming));
      if (!continuesList) close();
      continue;
    }

    const fence = FENCE_OPEN.exec(text);
    if (fence?.[1]) {
      const last = fenceEnd(lines, index, fence[1]);
      begin("single", index, last);
      index = last;
      close();
      continue;
    }

    if (THEMATIC_BREAK.test(text) || HEADING.test(text)) {
      begin("single", index);
      close();
      continue;
    }

    const current = state.open;
    const joins =
      current !== null &&
      (LIST_ITEM.test(text)
        ? current.kind === "list"
        : QUOTE.test(text)
          ? current.kind === "quote"
          : TABLE_ROW.test(text)
            ? current.kind === "table"
            : current.kind === "paragraph" || current.kind === "list" || current.kind === "quote");

    if (joins && current) {
      current.last = index;
      continue;
    }

    begin(
      LIST_ITEM.test(text)
        ? "list"
        : QUOTE.test(text)
          ? "quote"
          : TABLE_ROW.test(text)
            ? "table"
            : "paragraph",
      index,
    );
  }

  close();
  return blocks;
}

type Edit = { start: number; end: number; insert: string };

const applyEdits = (text: string, edits: readonly Edit[]): string =>
  [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((acc, edit) => acc.slice(0, edit.start) + edit.insert + acc.slice(edit.end), text);

const SEPARATOR = "\n\n";

/** The edits that turn `oldBlocks` (positions in the original) into `newTexts`. */
function planEdits(
  oldBlocks: readonly SourceBlock[],
  baseline: readonly string[],
  next: readonly string[],
): Edit[] {
  let prefix = 0;
  const limit = Math.min(baseline.length, next.length);
  while (prefix < limit && baseline[prefix] === next[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < limit - prefix &&
    baseline[baseline.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removed = oldBlocks.slice(prefix, oldBlocks.length - suffix);
  const added = next.slice(prefix, next.length - suffix);
  const first = removed[0];
  const last = removed[removed.length - 1];

  // Same count: edit in place, block by block, so a paragraph typed into does
  // not disturb the untouched ones around it.
  if (removed.length === added.length) {
    return removed.flatMap((block, offset) => {
      const text = added[offset];
      return text === undefined || baseline[prefix + offset] === text
        ? []
        : [{ start: block.start, end: block.end, insert: text }];
    });
  }

  if (first && last && added.length > 0) {
    return [{ start: first.start, end: last.end, insert: added.join(SEPARATOR) }];
  }

  if (first && last) {
    const after = oldBlocks[prefix + removed.length];
    const before = oldBlocks[prefix - 1];
    // Take the separator with the blocks: the one after them, or, at the end of
    // the document, the one before.
    if (after) return [{ start: first.start, end: after.start, insert: "" }];
    if (before) return [{ start: before.end, end: last.end, insert: "" }];
    return [{ start: first.start, end: last.end, insert: "" }];
  }

  // Pure insertion.
  const text = added.join(SEPARATOR);
  const anchor = oldBlocks[prefix];
  if (anchor) return [{ start: anchor.start, end: anchor.start, insert: text + SEPARATOR }];
  const tail = oldBlocks[oldBlocks.length - 1];
  return tail ? [{ start: tail.end, end: tail.end, insert: SEPARATOR + text }] : [];
}

/**
 * The Draft after the editor went from `baselineMarkdown` to `nextMarkdown`
 * (both as the editor exports them): `original` with only the changed blocks
 * rewritten.
 *
 * If the original's block structure does not line up with the editor's (a
 * construct the editor reads differently from the splitter), there is nothing
 * safe to splice into and the whole body is replaced by the editor's export.
 */
export function spliceMarkdown(
  original: string,
  baselineMarkdown: string,
  nextMarkdown: string,
): string {
  if (baselineMarkdown === nextMarkdown) return original;

  const baseline = splitSourceBlocks(baselineMarkdown).map((block) => block.text);
  const next = splitSourceBlocks(nextMarkdown).map((block) => block.text);
  const oldBlocks = splitSourceBlocks(original);

  if (oldBlocks.length === 0 || oldBlocks.length !== baseline.length) {
    const head = original.slice(0, frontmatterLength(original));
    const tail = /\n$/.test(original) ? "\n" : "";
    return head + next.join(SEPARATOR) + tail;
  }

  const edits = planEdits(oldBlocks, baseline, next);
  return applyEdits(original, edits);
}

/** What the editor loads: the Document without its front matter. */
export const markdownBody = (markdown: string): string =>
  markdown.slice(frontmatterLength(markdown));

/** The index of the block a source offset falls in (or the one just before it). */
export function blockIndexAtOffset(blocks: readonly SourceBlock[], offset: number): number {
  let found = 0;
  for (const [index, block] of blocks.entries()) {
    if (block.start > offset) break;
    found = index;
  }
  return found;
}
