import type { BlockAnchor } from "@mdreadr/domain";
import { findBlockRange } from "@mdreadr/domain";

/** Block ids are `<kind>-<hash>-<occurrence>`, so the kind an anchor needs is
 *  already in the id the reader puts in the DOM. */
const BLOCK_KINDS = [
  "heading",
  "paragraph",
  "code",
  "list",
  "table",
] as const satisfies readonly BlockAnchor["kind"][];

export function anchorFromBlockId(blockId: string): BlockAnchor | undefined {
  const kind = BLOCK_KINDS.find((candidate) => blockId.startsWith(`${candidate}-`));
  return kind ? { kind, blockId } : undefined;
}

/** Source offset a rendered block starts at, or `undefined` if that block is no
 *  longer in the markdown (stale id after an edit). */
export function offsetForBlockId(content: string, blockId: string): number | undefined {
  const anchor = anchorFromBlockId(blockId);
  return anchor ? findBlockRange(content, anchor)?.start : undefined;
}

/**
 * A point that exists in both modes: a rendered block's vertical position and
 * the source offset it starts at. A run of them is a piecewise-linear map
 * between the reader's pixels and the editor's offsets, which is what lets a
 * toggle land where the reader was.
 */
export type Landmark = {
  top: number;
  offset: number;
};

/** Landmarks must be sorted and strictly increasing on both axes for the
 *  interpolation to be a function; duplicate ids and re-ordered blocks would
 *  otherwise make a segment run backwards. */
export function usableLandmarks(landmarks: readonly Landmark[]): Landmark[] {
  const sorted = [...landmarks].sort((a, b) => a.offset - b.offset);
  return sorted.filter((landmark, index) => {
    const previous = sorted[index - 1];
    return !previous || (landmark.offset > previous.offset && landmark.top > previous.top);
  });
}

const lerp = (from: number, to: number, fraction: number): number => from + fraction * (to - from);

/** Piecewise-linear lookup: reads `key` off one axis of the landmarks and
 *  returns the matching point on the other. Outside the run, the nearest
 *  segment's slope is not extrapolated - the ends clamp, since guessing past
 *  the first or last landmark is what throws a toggle a screen off. */
function interpolate(
  landmarks: readonly Landmark[],
  key: number,
  from: (landmark: Landmark) => number,
  to: (landmark: Landmark) => number,
): number | undefined {
  const first = landmarks[0];
  const last = landmarks[landmarks.length - 1];
  if (!first || !last) return undefined;
  if (key <= from(first)) return to(first);
  if (key >= from(last)) return to(last);

  for (let index = 1; index < landmarks.length; index += 1) {
    const previous = landmarks[index - 1];
    const current = landmarks[index];
    if (!previous || !current || from(current) < key) continue;
    const span = from(current) - from(previous);
    const fraction = span > 0 ? (key - from(previous)) / span : 0;
    return lerp(to(previous), to(current), fraction);
  }

  return to(last);
}

/** Reader pixel position -> source offset, for opening the editor where the
 *  reader was looking. */
export const offsetAtPixel = (landmarks: readonly Landmark[], top: number): number | undefined =>
  interpolate(
    landmarks,
    top,
    (landmark) => landmark.top,
    (landmark) => landmark.offset,
  );

/** Source offset -> reader pixel position, for the way back. */
export const pixelAtOffset = (landmarks: readonly Landmark[], offset: number): number | undefined =>
  interpolate(
    landmarks,
    offset,
    (landmark) => landmark.offset,
    (landmark) => landmark.top,
  );
