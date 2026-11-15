import { describe, expect, it } from "bun:test";
import { offsetAtPixel, pixelAtOffset } from "../session/view-mode-continuity.ts";
import { type WriteElement, writeBlockIndexAtOffset, writeLandmarks } from "./handoff.ts";

const content = (tops: readonly number[]): WriteElement[] =>
  tops.map((top) => ({ top, empty: false }));

const DOC = "# Title\n\nFirst paragraph.\n\n- a\n- b\n\n```\ncode\n```\n";
// Offsets of the four blocks: heading, paragraph, list, fence.
const STARTS = [0, 9, 27, 36];

describe("Write mode handoff", () => {
  const tops = [100, 160, 220, 340];

  it("pairs each element with the source block it renders", () => {
    expect(writeLandmarks(content(tops), DOC).map((landmark) => landmark.offset)).toEqual(STARTS);
  });

  it("carries the fold out of Write as a source offset", () => {
    const landmarks = writeLandmarks(content(tops), DOC);
    expect(offsetAtPixel(landmarks, 160)).toBe(9);
    // Halfway through the list's element lands halfway through its source.
    expect(offsetAtPixel(landmarks, 280)).toBe(31.5);
    // Above the first and below the last clamp to the ends.
    expect(offsetAtPixel(landmarks, 0)).toBe(0);
    expect(offsetAtPixel(landmarks, 9999)).toBe(36);
  });

  it("carries a source offset into Write as a pixel position", () => {
    const landmarks = writeLandmarks(content(tops), DOC);
    expect(pixelAtOffset(landmarks, 27)).toBe(220);
    expect(pixelAtOffset(landmarks, 9)).toBe(160);
  });

  it("round-trips Write -> source -> Write at a block boundary", () => {
    const landmarks = writeLandmarks(content(tops), DOC);
    for (const top of tops) {
      const offset = offsetAtPixel(landmarks, top);
      expect(offset).not.toBeUndefined();
      expect(pixelAtOffset(landmarks, offset ?? 0)).toBe(top);
    }
  });

  it("offers no landmarks when the surface and the source disagree", () => {
    expect(writeLandmarks(content([100, 160, 190, 220, 340]), DOC)).toEqual([]);
    expect(writeLandmarks([], DOC)).toEqual([]);
    expect(writeLandmarks(content([100]), "")).toEqual([]);
  });

  it("skips blank paragraphs the reader added", () => {
    const elements: WriteElement[] = [
      { top: 100, empty: false },
      { top: 130, empty: true },
      { top: 160, empty: false },
      { top: 190, empty: true },
      { top: 220, empty: false },
      { top: 340, empty: false },
      { top: 400, empty: true },
    ];
    const landmarks = writeLandmarks(elements, DOC);
    expect(landmarks.map((landmark) => landmark.offset)).toEqual(STARTS);
    expect(landmarks.map((landmark) => landmark.top)).toEqual(tops);
  });

  it("reports the element index among all elements, blanks included", () => {
    const empties = [false, true, false, false, true, false];
    expect(writeBlockIndexAtOffset(DOC, 9, empties)).toBe(2);
    expect(writeBlockIndexAtOffset(DOC, 36, empties)).toBe(5);
  });

  it("drops elements that are not strictly below the one before", () => {
    expect(writeLandmarks(content([100, 100, 220, 340]), DOC).length).toBe(3);
  });

  it("finds the element the caret belongs in", () => {
    const plain = [false, false, false, false];
    expect(writeBlockIndexAtOffset(DOC, 0, plain)).toBe(0);
    expect(writeBlockIndexAtOffset(DOC, 30, plain)).toBe(2);
    expect(writeBlockIndexAtOffset(DOC, 36, plain)).toBe(3);
    expect(writeBlockIndexAtOffset(DOC, 30, [...plain, false])).toBeUndefined();
  });

  it("ignores front matter when pairing", () => {
    const withFront = `---\ntitle: x\n---\n${DOC}`;
    const [first] = writeLandmarks(content(tops), withFront);
    expect(first?.offset).toBe("---\ntitle: x\n---\n".length);
  });
});
