import type { Landmark } from "../session/view-mode-continuity.ts";
import { usableLandmarks } from "../session/view-mode-continuity.ts";
import { blockIndexAtOffset, splitSourceBlocks } from "./splice.ts";

/** A top-level element of the Write surface, as the handoff sees it. */
export type WriteElement = {
  top: number;
  /** A blank paragraph: it shows no content and has no block in the source. */
  empty: boolean;
};

/**
 * Landmarks for the Write surface: its top-level elements, in order, against the
 * source blocks of the Draft. Blank paragraphs are left out first, since the
 * source has no block for them (the reader just pressed Enter twice, say); the
 * i-th remaining element is then the i-th block. If the counts still disagree
 * (a construct read differently) the pairing would be a guess, so there are no
 * landmarks and the toggle leaves the position alone.
 */
export function writeLandmarks(elements: readonly WriteElement[], markdown: string): Landmark[] {
  const blocks = splitSourceBlocks(markdown);
  const content = elements.filter((element) => !element.empty);
  if (blocks.length === 0 || blocks.length !== content.length) return [];
  return usableLandmarks(
    blocks.map((block, index) => ({ top: content[index]?.top ?? 0, offset: block.start })),
  );
}

/**
 * The index, among all of the surface's elements, of the one a caret should land
 * in for a source offset, or `undefined` when the surface does not pair up with
 * the source.
 */
export function writeBlockIndexAtOffset(
  markdown: string,
  offset: number,
  empties: readonly boolean[],
): number | undefined {
  const blocks = splitSourceBlocks(markdown);
  const contentIndexes = empties.flatMap((empty, index) => (empty ? [] : [index]));
  if (blocks.length === 0 || blocks.length !== contentIndexes.length) return undefined;
  return contentIndexes[blockIndexAtOffset(blocks, offset)];
}
