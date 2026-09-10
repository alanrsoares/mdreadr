import type { SubBlockTarget } from "@mdreadr/domain";

/**
 * Turning a gesture inside a rendered list or table into the sub-block it
 * landed on. The cut that keeps the rest of the block on screen around the
 * open editor is `splitAroundSubBlock`, in the domain: it is source in, source
 * out, with no node to read.
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

/** What the sub-block is called in a menu item, a hint or an accessible name. */
export const subBlockNoun = (kind: SubBlockTarget["kind"]): string =>
  kind === "list-item" ? "item" : "row";
