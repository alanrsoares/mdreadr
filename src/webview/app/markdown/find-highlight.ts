/**
 * Painting find matches on the rendered Document.
 *
 * The reader's prose is React's output, so a find cannot wrap matches in
 * `<mark>`: the next render would drop the wrappers, and inserting elements
 * mid-paragraph reflows the text the reader is looking at, which DESIGN.md §5
 * bans outright. The CSS Custom Highlight API paints ranges without touching
 * the DOM at all, which is exactly the shape of this problem.
 *
 * The offsets a match carries are into the Document's *flat* text, so the map
 * from those back to (text node, offset) is the part worth testing; it is kept
 * free of DOM types for that reason.
 */

import type { FindMatch } from "./find-matches.ts";

/** One text run of the flattened Document: its length, in document order. */
export type TextChunk = { length: number };

/** Where one end of a match sits: which chunk, and how far into it. */
export type ChunkPosition = { chunk: number; offset: number };

export type ChunkSpan = { start: ChunkPosition; end: ChunkPosition };

/**
 * Maps a flat-text range onto the chunks it spans. A match that runs across
 * two text nodes (`**bold** text` renders as two) still gets one span with its
 * ends in different chunks, which is what a Range wants.
 *
 * `null` when the range falls outside the text entirely, which happens when the
 * Document re-renders between finding a match and painting it.
 */
export function locateSpan(chunks: TextChunk[], match: FindMatch): ChunkSpan | null {
  const start = locatePosition(chunks, match.start);
  const end = locatePosition(chunks, match.end);
  return start && end ? { start, end } : null;
}

function locatePosition(chunks: TextChunk[], offset: number): ChunkPosition | null {
  if (offset < 0) return null;

  let remaining = offset;
  for (const [index, chunk] of chunks.entries()) {
    // `<=`, not `<`: an end offset landing exactly on a chunk boundary belongs
    // to the chunk that ends there, not to the start of the next one.
    if (remaining <= chunk.length) return { chunk: index, offset: remaining };
    remaining -= chunk.length;
  }

  return null;
}

const HIGHLIGHT_ALL = "mdreadr-find";
const HIGHLIGHT_CURRENT = "mdreadr-find-current";

type HighlightRegistry = {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => void;
};

type HighlightApi = {
  highlights: HighlightRegistry;
  Highlight: new (...ranges: Range[]) => unknown;
};

/**
 * The Highlight API, or `null` where the webview predates it (WebKitGTK before
 * 2.44). Find still scrolls and counts there; only the paint is missing, which
 * is a degraded find rather than a broken one.
 */
function highlightApi(): HighlightApi | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  const Highlight = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  return css?.highlights && Highlight ? { highlights: css.highlights, Highlight } : null;
}

export const canPaintHighlights = (): boolean => highlightApi() !== null;

/** Every text node under `root`, in document order, skipping empty ones. */
export function collectTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text && node.data.length > 0) nodes.push(node);
    node = walker.nextNode();
  }
  return nodes;
}

const rangeFor = (nodes: Text[], span: ChunkSpan): Range | null => {
  const startNode = nodes[span.start.chunk];
  const endNode = nodes[span.end.chunk];
  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, Math.min(span.start.offset, startNode.data.length));
  range.setEnd(endNode, Math.min(span.end.offset, endNode.data.length));
  return range;
};

export type PaintedFind = {
  /** The range the reader is on, for scrolling it into view. `null` when there is none. */
  currentRange: Range | null;
};

/**
 * Paints every match, and the current one in its own colour. Returns the
 * current range so the caller can scroll to it without walking the DOM twice.
 */
export function paintMatches(
  nodes: Text[],
  matches: FindMatch[],
  currentIndex: number,
): PaintedFind {
  const api = highlightApi();
  const chunks = nodes.map((node) => ({ length: node.data.length }));
  const ranges: Range[] = [];
  let currentRange: Range | null = null;

  for (const [index, match] of matches.entries()) {
    const span = locateSpan(chunks, match);
    const range = span && rangeFor(nodes, span);
    if (!range) continue;
    if (index === currentIndex) currentRange = range;
    else ranges.push(range);
  }

  if (api) {
    api.highlights.set(HIGHLIGHT_ALL, new api.Highlight(...ranges));
    api.highlights.set(
      HIGHLIGHT_CURRENT,
      currentRange ? new api.Highlight(currentRange) : new api.Highlight(),
    );
  }

  return { currentRange };
}

/** Removes every painted range. Safe to call when nothing was ever painted. */
export function clearHighlights(): void {
  const api = highlightApi();
  if (!api) return;
  api.highlights.delete(HIGHLIGHT_ALL);
  api.highlights.delete(HIGHLIGHT_CURRENT);
}
