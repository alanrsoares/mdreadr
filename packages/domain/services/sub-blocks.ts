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

/**
 * The part of a block that renders *after* the open editor, with the map a
 * gesture in it needs.
 *
 * The tail is a standalone markdown document: its own list paths start over at
 * zero and its table body rows start over at one, so a double-click in it names
 * a sub-block of the tail, not of the block. The map is built while the cut is
 * made — the only moment both coordinate spaces are in hand — so no caller can
 * hold a tail whose coordinates it has to re-derive.
 */
export type SubBlockTail = {
  /** The tail's source, renderable on its own. */
  source: string;
  /** Every sub-block of `source`, paired with the block sub-block it is. */
  targets: readonly SubBlockCorrespondence[];
};

/** One sub-block, named twice: as the tail sees it and as the block does. */
export type SubBlockCorrespondence = {
  local: SubBlockTarget;
  parent: SubBlockTarget;
};

export type SubBlockSplit = {
  /** The block's source before the edited sub-block, still valid markdown on
   *  its own, or `undefined` when nothing precedes it. Needs no coordinate map:
   *  it is a prefix of the block, so its sub-blocks are already the block's. */
  before?: string;
  /** The edited sub-block's own source, the editor's seed. */
  source: string;
  /** What renders after it, or `undefined` when it was the last sub-block. */
  after?: SubBlockTail;
};

/** Which block sub-block a gesture in the tail landed on, or `undefined` for a
 *  gesture the tail cannot place in the block — a reopened ancestor marker,
 *  which has no source of its own, so the whole block is the honest answer. */
export const mapTailTarget = (
  tail: SubBlockTail,
  local: SubBlockTarget,
): SubBlockTarget | undefined =>
  tail.targets.find((entry) => sameSubBlockTarget(entry.local, local))?.parent;

/** The table's header line plus its alignment delimiter, which a tail slice
 *  has to carry to still be a table. */
const tableHead = (lines: string[]): string[] => lines.slice(0, 2);

/** The alignment row with its dashes blanked out: a header of empty cells,
 *  which is what the body needs above it to still render as a table while the
 *  real header is the thing being edited. */
const blankHeader = (delimiter: string): string => delimiter.replace(/[-:]+/g, " ");

/**
 * The tail of a split table, whose head is repeated above the remaining rows.
 * Row 0 of the tail is that repeated head, which stands for the block's own
 * header; every body row after it sits `editedRow` further down the block.
 */
function tableTail(source: string, editedRow: number): SubBlockTail {
  return {
    source,
    targets: tableRowSpans(source).flatMap(({ target }) =>
      target.kind === "table-row"
        ? [
            {
              local: target,
              parent: {
                kind: "table-row" as const,
                row: target.row === 0 ? 0 : editedRow + target.row,
              },
            },
          ]
        : [],
    ),
  };
}

function splitTable(blockSource: string, row: number): SubBlockSplit | undefined {
  const lines = blockSource.split("\n").filter((line) => line.trim() !== "");
  const head = tableHead(lines);
  const body = lines.slice(2);

  // Editing the header: the body stays on screen under a blank header rather
  // than under a copy of the line the reader is busy rewriting.
  if (row === 0) {
    const [header, delimiter] = head;
    if (header === undefined || delimiter === undefined) return { source: header ?? blockSource };
    return {
      source: header,
      ...(body.length > 0
        ? { after: tableTail([blankHeader(delimiter), delimiter, ...body].join("\n"), 0) }
        : {}),
    };
  }

  const index = row - 1;
  const source = body[index];
  if (source === undefined) return undefined;

  const leading = body.slice(0, index);
  const trailing = body.slice(index + 1);
  return {
    before: [...head, ...leading].join("\n"),
    source,
    // The head repeats above the tail rows: they would not render as a table
    // without it, and the repeat only exists while the editor is open.
    ...(trailing.length > 0 ? { after: tableTail([...head, ...trailing].join("\n"), row) } : {}),
  };
}

/** The empty markers of an item's ancestors, outermost first, so a tail slice
 *  of a nested list nests at the depth the author wrote. */
function ancestorMarkers(blockSource: string, spans: SubBlockSpan[], path: number[]): string[] {
  return path.slice(0, -1).flatMap((_, depth) => {
    const ancestorPath = path.slice(0, depth + 1);
    const ancestor = spans.find(
      (entry) => entry.target.kind === "list-item" && samePath(entry.target.path, ancestorPath),
    );
    if (!ancestor) return [];
    const line = blockSource.slice(ancestor.range.start).split("\n")[0] ?? "";
    const marker = listItemMarkerPrefix(line);
    return marker === undefined ? [] : [marker];
  });
}

/**
 * The tail of a split list. Every item in it is a slice of the block's own
 * source, so the two coordinate spaces are paired by where each item starts:
 * offset in the tail, minus the reopened ancestors that have no source behind
 * them, plus where the tail was cut from.
 */
function listTail(
  spans: SubBlockSpan[],
  source: string,
  cutFrom: number,
  reopenedLength: number,
): SubBlockTail {
  return {
    source,
    targets: collectSubBlocks(source, "list-item").flatMap((local) => {
      // A reopened ancestor marker is not the author's text and stands for no
      // item of the block.
      if (local.range.start < reopenedLength) return [];
      const start = cutFrom + local.range.start - reopenedLength;
      const parent = spans.find((entry) => entry.range.start === start);
      return parent ? [{ local: local.target, parent: parent.target }] : [];
    }),
  };
}

/**
 * Splits a list or table's source into the part before the edited sub-block,
 * the sub-block itself, and the tail after it, so the reader keeps the rest of
 * the block on screen while one item or row is open in the editor.
 *
 * Slices of the original source, so ordered markers keep their own numbers and
 * the tail list carries on counting from where the author left off.
 */
export function splitAroundSubBlock(
  blockSource: string,
  target: SubBlockTarget,
): SubBlockSplit | undefined {
  if (target.kind === "table-row") return splitTable(blockSource, target.row);

  const spans = collectSubBlocks(blockSource, "list-item");
  const span = spans.find(
    (entry) => entry.target.kind === "list-item" && samePath(entry.target.path, target.path),
  );
  if (!span) return undefined;

  // Cut at the item's own boundaries: what is left on either side is still a
  // list, at the indentation the author wrote, so a sibling of the edited item
  // keeps its nesting and an ordered list keeps its own numbers.
  const before = blockSource.slice(0, span.range.start).replace(/\n+$/, "");
  const rawAfter = blockSource.slice(span.range.end);
  const after = rawAfter.replace(/^\n+/, "");
  // A nested item's tail is its own document, so its ancestors have to open
  // again above it or the sibling left behind renders at the top level. They
  // reopen empty: their text is already on screen in `before`.
  const reopened = ancestorMarkers(blockSource, spans, target.path);
  const tail = after.length > 0 ? [...reopened, after].join("\n") : "";

  return {
    ...(before.length > 0 ? { before } : {}),
    source: blockSource.slice(span.range.start, span.range.end),
    ...(tail.length > 0
      ? {
          after: listTail(
            spans,
            tail,
            span.range.end + rawAfter.length - after.length,
            reopened.length > 0 ? reopened.join("\n").length + 1 : 0,
          ),
        }
      : {}),
  };
}
