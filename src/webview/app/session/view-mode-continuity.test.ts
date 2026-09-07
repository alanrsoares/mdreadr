import { describe, expect, it } from "bun:test";
import { blockIdForParagraph } from "@mdreadr/domain";
import {
  anchorFromBlockId,
  type Landmark,
  offsetAtPixel,
  offsetForBlockId,
  pixelAtOffset,
  usableLandmarks,
} from "./view-mode-continuity.ts";

const content = [
  "# Document Title",
  "",
  "First paragraph text.",
  "",
  "## Section Two",
  "",
  "Second paragraph text.",
].join("\n");

describe("anchorFromBlockId", () => {
  it("reads the kind back out of the id", () => {
    expect(anchorFromBlockId("heading-section-two")).toEqual({
      kind: "heading",
      blockId: "heading-section-two",
    });
    expect(anchorFromBlockId(blockIdForParagraph("First paragraph text.", 0))?.kind).toBe(
      "paragraph",
    );
  });

  it("returns nothing for an id with no kind prefix", () => {
    expect(anchorFromBlockId("document-root")).toBeUndefined();
    expect(anchorFromBlockId("nonsense")).toBeUndefined();
  });
});

describe("offsetForBlockId", () => {
  it("points at the start of the block in the source", () => {
    const blockId = blockIdForParagraph("Second paragraph text.", 0);
    expect(offsetForBlockId(content, blockId)).toBe(content.indexOf("Second paragraph text."));
  });

  it("returns nothing when the block is no longer in the document", () => {
    expect(offsetForBlockId(content, blockIdForParagraph("Gone.", 0))).toBeUndefined();
  });
});

describe("usableLandmarks", () => {
  it("sorts by offset", () => {
    const landmarks: Landmark[] = [
      { top: 300, offset: 200 },
      { top: 100, offset: 0 },
    ];
    expect(usableLandmarks(landmarks)).toEqual([
      { top: 100, offset: 0 },
      { top: 300, offset: 200 },
    ]);
  });

  it("drops points that would make a segment run backwards", () => {
    const landmarks: Landmark[] = [
      { top: 100, offset: 0 },
      // A stale duplicate id, or the same block rendered twice.
      { top: 90, offset: 100 },
      { top: 300, offset: 100 },
      { top: 400, offset: 200 },
    ];
    expect(usableLandmarks(landmarks)).toEqual([
      { top: 100, offset: 0 },
      { top: 400, offset: 200 },
    ]);
  });
});

describe("offsetAtPixel / pixelAtOffset", () => {
  const landmarks: Landmark[] = [
    { top: 0, offset: 0 },
    { top: 100, offset: 50 },
    { top: 300, offset: 250 },
  ];

  it("returns the landmark itself when the key lands on one", () => {
    expect(offsetAtPixel(landmarks, 100)).toBe(50);
    expect(pixelAtOffset(landmarks, 50)).toBe(100);
  });

  it("interpolates inside a segment", () => {
    expect(offsetAtPixel(landmarks, 200)).toBe(150);
    expect(pixelAtOffset(landmarks, 150)).toBe(200);
  });

  it("clamps at both ends rather than extrapolating", () => {
    expect(offsetAtPixel(landmarks, -5000)).toBe(0);
    expect(offsetAtPixel(landmarks, 5000)).toBe(250);
    expect(pixelAtOffset(landmarks, -5000)).toBe(0);
    expect(pixelAtOffset(landmarks, 5000)).toBe(300);
  });

  it("round-trips a pixel through an offset and back", () => {
    for (const top of [0, 37, 100, 199, 300]) {
      const offset = offsetAtPixel(landmarks, top) ?? -1;
      expect(pixelAtOffset(landmarks, offset)).toBeCloseTo(top, 6);
    }
  });

  it("has nothing to say with no landmarks", () => {
    expect(offsetAtPixel([], 100)).toBeUndefined();
    expect(pixelAtOffset([], 100)).toBeUndefined();
  });
});
