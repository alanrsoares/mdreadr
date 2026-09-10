/**
 * Sub-block targeting: the ranges *inside* a list or a table block that a
 * reader can edit on their own — one list item, one table row.
 *
 * Deliberately not an Anchor. An Anchor is persisted (notes, suggestions, the
 * MCP surface) and has to survive the document changing under it; a sub-block
 * target lives only as long as an open inline editor, so it can be a plain
 * positional index resolved against the parent block's current source. Nothing
 * on disk gains a new shape because a list item became editable.
 *
 * The parser only carries `range` on top-level blocks, so the spans here are
 * scanned off the parent block's own source text rather than read off nodes.
 * Line-based on purpose: it keeps every byte the author wrote (markers,
 * indentation, alignment padding) instead of reconstructing markdown from an
 * AST, which is the same rule `resolveBlockRawMarkdown` follows.
 */

import { match } from "@onrails/pattern";
import type { BlockAnchor } from "../schemas/index.ts";
import { type BlockSourceRange, findBlockRange, type ResolveBlockTextOptions } from "./anchors.ts";
import { truncateAnchorLabel } from "./markdown.ts";

/** One editable region inside a block, addressed by position within it. */
export type SubBlockTarget =
  /** An item of the list, by the path of 0-based positions from the list's own
   *  items down: `[2]` is the third item, `[2, 0]` its first nested item. An
   *  item's range covers its nested children, so editing `[2]` still edits the
   *  whole subtree, and editing `[2, 0]` edits only that child. */
  | { kind: "list-item"; path: number[] }
  /** A row of the table: 0 is the header, body rows follow it. The alignment
   *  delimiter is not a row and can never be targeted. */
  | { kind: "table-row"; row: number };

export type SubBlockSpan = {
  target: SubBlockTarget;
  /** Offsets into the *block's* source, not the document's. */
  range: BlockSourceRange;
  /** Short preview, for a menu item or an editor's accessible name. */
  label: string;
};

/** Two paths naming the same item, step for step. */
export const samePath = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((step, index) => step === b[index]);

/** Two targets naming the same part. By value, not identity: a second gesture
 *  on the part already open is the same part, not a competing one. `null` is a
 *  whole block, which is the same as another whole block. */
export const sameSubBlockTarget = (a: SubBlockTarget | null, b: SubBlockTarget | null): boolean => {
  if (a === null || b === null) return a === b;
  if (a.kind === "list-item" && b.kind === "list-item") return samePath(a.path, b.path);
  return a.kind === "table-row" && b.kind === "table-row" && a.row === b.row;
};

/** Which sub-block a block kind can be broken into, if any. */
export const subBlockKindForAnchor = (anchor: BlockAnchor): SubBlockTarget["kind"] | undefined =>
  match(anchor.kind)
    .returnType<SubBlockTarget["kind"] | undefined>()
    .with("list", () => "list-item")
    .with("table", () => "table-row")
    .otherwise(() => undefined);

/** A list item's opening line: bullet or ordered marker, any indentation. */
const LIST_MARKER = /^(\s*)(?:[-*+]|\d{1,9}[.)])(?:\s|$)/;

/** A fenced code block's opening or closing line, at any indentation. */
const FENCE = /^\s*(`{3,}|~{3,})/;

/** A table's alignment row, e.g. `|:---|---:|`. */
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

type SourceLine = { text: string; start: number; end: number };

const toLines = (source: string): SourceLine[] => {
  const lines: SourceLine[] = [];
  let start = 0;
  for (const text of source.split("\n")) {
    lines.push({ text, start, end: start + text.length });
    start += text.length + 1;
  }
  return lines;
};

const indentOf = (line: string): number => LIST_MARKER.exec(line)?.[1]?.length ?? 0;

/**
 * The opening marker of a list item's line — its indentation and bullet, with
 * the item's own text dropped. An empty item at the same depth, which is what
 * a split list's tail needs to keep nesting at the depth the author wrote.
 */
export const listItemMarkerPrefix = (line: string): string | undefined =>
  LIST_MARKER.exec(line)?.[0].replace(/\s+$/, "");

/**
 * The lines that open a list item, fenced code skipped: `- not an item` inside
 * a fence is code the author wrote, and counting it would shift every path
 * after it away from the item the reader actually aimed at.
 */
function markerLines(lines: SourceLine[]): { indent: number; lineIndex: number }[] {
  let fence: string | undefined;
  return lines.flatMap((line, lineIndex) => {
    const marker = FENCE.exec(line.text)?.[1];
    if (fence !== undefined) {
      // Only a run of the same character, at least as long, closes a fence.
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      return [];
    }
    if (marker) {
      fence = marker;
      return [];
    }
    return LIST_MARKER.test(line.text) ? [{ indent: indentOf(line.text), lineIndex }] : [];
  });
}

/** Drops the blank lines a loose list leaves between items, so an item's range
 *  ends at its last real line and applying an edit does not eat the gap. */
const trimBlankTail = (lines: SourceLine[]): SourceLine[] => {
  let end = lines.length;
  while (end > 0 && (lines[end - 1]?.text.trim() ?? "") === "") end -= 1;
  return lines.slice(0, end);
};

const spanOf = (lines: SourceLine[]): BlockSourceRange | undefined => {
  const kept = trimBlankTail(lines);
  const first = kept[0];
  const last = kept.at(-1);
  return first && last ? { start: first.start, end: last.end } : undefined;
};

type ItemNode = {
  range: BlockSourceRange;
  children: ItemNode[];
};

/**
 * The list's items as a tree, so a nested item is addressable on its own and
 * still sits inside its parent's range.
 *
 * Nesting comes from marker indentation, and every non-marker line (a
 * continuation paragraph, an indented fence, a loose list's blank line) belongs
 * to the innermost item open above it.
 */
function listItemTree(source: string): ItemNode[] {
  const lines = toLines(source);
  const markers = markerLines(lines);

  // An item runs to the last line before the next marker that is not indented
  // deeper than its own, blank tail dropped: that sweeps up its continuation
  // paragraphs, its indented fences and all of its nested items.
  const items = markers.flatMap(({ indent, lineIndex }, order) => {
    const next = markers.slice(order + 1).find((marker) => marker.indent <= indent);
    const lastLine = next ? next.lineIndex : lines.length;
    const range = spanOf(lines.slice(lineIndex, lastLine));
    return range ? [{ indent, order, node: { range, children: [] as ItemNode[] } }] : [];
  });

  const roots: ItemNode[] = [];
  for (const item of items) {
    // An item's parent is the nearest one before it that is less indented.
    const parent = items
      .slice(0, items.indexOf(item))
      .reverse()
      .find((candidate) => candidate.indent < item.indent);
    (parent ? parent.node.children : roots).push(item.node);
  }
  return roots;
}

/** Flattens the tree in document order, parents before their children. */
function flattenItems(nodes: ItemNode[], source: string, prefix: number[]): SubBlockSpan[] {
  return nodes.flatMap((node, index) => {
    const path = [...prefix, index];
    return [
      {
        target: { kind: "list-item" as const, path },
        range: node.range,
        label: truncateAnchorLabel(source.slice(node.range.start, node.range.end).trim()),
      },
      ...flattenItems(node.children, source, path),
    ];
  });
}

function listItemSpans(source: string): SubBlockSpan[] {
  return flattenItems(listItemTree(source), source, []);
}

/** Walks the tree by path, `undefined` when the path no longer leads anywhere. */
function itemAtPath(nodes: ItemNode[], path: number[]): ItemNode | undefined {
  const [head, ...rest] = path;
  if (head === undefined) return undefined;
  const node = nodes[head];
  if (!node) return undefined;
  return rest.length === 0 ? node : itemAtPath(node.children, rest);
}

function tableRowSpans(source: string): SubBlockSpan[] {
  const [header, delimiter, ...body] = toLines(source).filter((line) => line.text.trim() !== "");
  // A header and its delimiter are what make a table a table; without the
  // delimiter this is not one, and splicing a "row" of it would be a guess.
  // Only the second line can be that delimiter — a dash-only line further down
  // is a body row GFM renders, so dropping it would shift every row after it.
  if (!header || !delimiter || !TABLE_DELIMITER.test(delimiter.text)) return [];
  const rows = [header, ...body];

  return rows.map((line, row) => ({
    target: { kind: "table-row" as const, row },
    range: { start: line.start, end: line.end },
    label: truncateAnchorLabel(line.text.trim()),
  }));
}

/**
 * Every sub-block of one block's source, in document order, with ranges
 * relative to that source. Empty for a block kind that has no sub-blocks, and
 * for a list or table whose source does not actually parse as one.
 */
export function collectSubBlocks(
  blockSource: string,
  kind: SubBlockTarget["kind"],
): SubBlockSpan[] {
  return match(kind)
    .with("list-item", () => listItemSpans(blockSource))
    .with("table-row", () => tableRowSpans(blockSource))
    .exhaustive();
}

/**
 * The document range of one sub-block, or `undefined` when the parent block or
 * the sub-block itself is no longer where the caller last saw it (the document
 * changed while an editor was open).
 */
export function findSubBlockRange(
  content: string,
  anchor: BlockAnchor,
  target: SubBlockTarget,
  options?: ResolveBlockTextOptions,
): BlockSourceRange | undefined {
  const block = findBlockRange(content, anchor, options);
  if (!block) return undefined;

  const blockSource = content.slice(block.start, block.end);
  const range = match(target)
    .with({ kind: "list-item" }, ({ path }) => itemAtPath(listItemTree(blockSource), path)?.range)
    .with({ kind: "table-row" }, ({ row }) => tableRowSpans(blockSource)[row]?.range)
    .exhaustive();
  if (!range) return undefined;

  return {
    start: block.start + range.start,
    end: block.start + range.end,
  };
}

/** The raw markdown of one sub-block, exactly as it sits in the document. */
export function resolveSubBlockRawMarkdown(
  content: string,
  anchor: BlockAnchor,
  target: SubBlockTarget,
  options?: ResolveBlockTextOptions,
): string | undefined {
  const range = findSubBlockRange(content, anchor, target, options);
  return range ? content.slice(range.start, range.end) : undefined;
}

/**
 * Replaces one sub-block's source, leaving every other byte of the document
 * alone — the rest of the list, the table's other rows, and the blank lines
 * between them all survive byte for byte.
 */
export function applySubBlockEdit(
  content: string,
  anchor: BlockAnchor,
  target: SubBlockTarget,
  newMarkdown: string,
  options?: ResolveBlockTextOptions,
): string | undefined {
  const range = findSubBlockRange(content, anchor, target, options);
  if (!range) return undefined;
  return `${content.slice(0, range.start)}${newMarkdown}${content.slice(range.end)}`;
}
