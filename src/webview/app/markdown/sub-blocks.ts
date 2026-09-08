import {
  collectSubBlocks,
  listItemMarkerPrefix,
  type SubBlockSpan,
  type SubBlockTarget,
} from "@mdreadr/domain";

/**
 * Turning a gesture inside a rendered list or table into the sub-block it
 * landed on, and rendering the rest of that block around the open editor.
 *
 * The path is read off the DOM rather than off a re-parse: the rendered list
 * item the reader double-clicked is the item they mean, and its position among
 * its siblings is the position the source scan hands back at that depth. The
 * innermost item wins, so a nested item is editable on its own; the reader
 * takes the whole subtree by aiming at the parent's own line instead.
 */

/** The chain of `li` ancestors of `node` inside `root`, outermost first. */
function listItemChain(root: HTMLElement, node: Node): HTMLElement[] {
  const start = node instanceof HTMLElement ? node : node.parentElement;
  let chain: HTMLElement[] = [];
  let item = start?.closest("li") ?? null;
  while (item && root.contains(item)) {
    chain = [item, ...chain];
    item = item.parentElement?.closest("li") ?? null;
  }
  return chain;
}

/** Position of `element` among the element children of its parent that match `selector`. */
const indexAmongSiblings = (element: HTMLElement, selector: string): number =>
  Array.from(element.parentElement?.children ?? [])
    .filter((sibling): sibling is HTMLElement => sibling.matches(selector))
    .indexOf(element);

function tableRowTarget(root: HTMLElement, node: Node): SubBlockTarget | undefined {
  const start = node instanceof HTMLElement ? node : node.parentElement;
  const row = start?.closest("tr");
  if (!row || !root.contains(row)) return undefined;

  // Row 0 is the header, then body rows in order: the same numbering
  // `collectSubBlocks` uses, which skips the alignment delimiter entirely.
  const isHeader = row.parentElement?.tagName === "THEAD";
  if (isHeader) return { kind: "table-row", row: 0 };

  const index = indexAmongSiblings(row, "tr");
  return index < 0 ? undefined : { kind: "table-row", row: index + 1 };
}

/**
 * Which sub-block of `root` the event landed on. `undefined` when the gesture
 * was on the block but outside any item or row (a list's own padding, a
 * table's caption), which is a request to edit the whole block.
 */
export function subBlockTargetFromNode(
  root: HTMLElement,
  node: Node | null,
  kind: SubBlockTarget["kind"],
): SubBlockTarget | undefined {
  if (!node || !root.contains(node)) return undefined;

  if (kind === "table-row") return tableRowTarget(root, node);

  const chain = listItemChain(root, node);
  if (chain.length === 0) return undefined;
  const path = chain.map((item) => indexAmongSiblings(item, "li"));
  // A position the DOM cannot place is a path the source cannot follow either.
  return path.some((index) => index < 0) ? undefined : { kind: "list-item", path };
}

const samePath = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((step, index) => step === b[index]);

/** Two targets naming the same part. By value, not identity: a second gesture
 *  on the part already open is the same editor, not a competing one. */
export const sameSubBlockTarget = (a: SubBlockTarget | null, b: SubBlockTarget | null): boolean => {
  if (a === null || b === null) return a === b;
  if (a.kind === "list-item" && b.kind === "list-item") return samePath(a.path, b.path);
  return a.kind === "table-row" && b.kind === "table-row" && a.row === b.row;
};

export type SubBlockSplit = {
  /** The block's source before the edited sub-block, still valid markdown on
   *  its own, or `undefined` when nothing precedes it. */
  before?: string;
  /** The edited sub-block's own source, the editor's seed. */
  source: string;
  /** The source after it, likewise renderable on its own. */
  after?: string;
};

/** The table's header line plus its alignment delimiter, which a tail slice
 *  has to carry to still be a table. */
const tableHead = (lines: string[]): string[] => lines.slice(0, 2);

/** The alignment row with its dashes blanked out: a header of empty cells,
 *  which is what the body needs above it to still render as a table while the
 *  real header is the thing being edited. */
const blankHeader = (delimiter: string): string => delimiter.replace(/[-:]+/g, " ");

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
        ? { after: [blankHeader(delimiter), delimiter, ...body].join("\n") }
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
    ...(trailing.length > 0 ? { after: [...head, ...trailing].join("\n") } : {}),
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
 * Splits a list or table's source into the part before the edited sub-block,
 * the sub-block itself, and the part after, so the reader keeps the rest of
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
  const after = blockSource.slice(span.range.end).replace(/^\n+/, "");
  // A nested item's tail is its own document, so its ancestors have to open
  // again above it or the sibling left behind renders at the top level. They
  // reopen empty: their text is already on screen in `before`.
  const reopened = ancestorMarkers(blockSource, spans, target.path);
  const tail = after.length > 0 ? [...reopened, after].join("\n") : "";

  return {
    ...(before.length > 0 ? { before } : {}),
    source: blockSource.slice(span.range.start, span.range.end),
    ...(tail.length > 0 ? { after: tail } : {}),
  };
}

/** What the sub-block is called in a menu item, a hint or an accessible name. */
export const subBlockNoun = (kind: SubBlockTarget["kind"]): string =>
  kind === "list-item" ? "item" : "row";
