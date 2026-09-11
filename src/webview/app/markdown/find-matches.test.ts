import { describe, expect, it } from "bun:test";
import { findMatches, matchNearestTo, stepMatch } from "./find-matches.ts";

describe("findMatches", () => {
  it("finds every occurrence in document order", () => {
    expect(findMatches("anchor, anchored, anchor", "anchor")).toEqual([
      { start: 0, end: 6 },
      { start: 8, end: 14 },
      { start: 18, end: 24 },
    ]);
  });

  it("ignores case on both sides", () => {
    expect(findMatches("Measure and MEASURE", "measure")).toHaveLength(2);
  });

  it("treats the term as text, not a pattern", () => {
    expect(findMatches("call useMemo(x) here", "useMemo(")).toEqual([{ start: 5, end: 13 }]);
  });

  it("does not overlap matches", () => {
    expect(findMatches("aaaa", "aa")).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });

  it("keeps offsets in the original text when lower-casing would grow it", () => {
    // "\u0130".toLowerCase() is two characters, so a lower-cased scan reports
    // this match one position late and paints "oo".
    expect(findMatches("\u0130xfoo", "foo")).toEqual([{ start: 2, end: 5 }]);
  });

  it("matches a term whose own case differs from the text, across scripts", () => {
    expect(findMatches("Straße und STRASSE", "stra\u00dfe")).toEqual([{ start: 0, end: 6 }]);
  });

  it("finds nothing for an empty term or an empty document", () => {
    expect(findMatches("anything", "")).toEqual([]);
    expect(findMatches("", "anything")).toEqual([]);
  });
});

describe("stepMatch", () => {
  it("starts at the first match going forward and the last going back", () => {
    expect(stepMatch(3, -1, 1)).toBe(0);
    expect(stepMatch(3, -1, -1)).toBe(2);
  });

  it("wraps at both ends", () => {
    expect(stepMatch(3, 2, 1)).toBe(0);
    expect(stepMatch(3, 0, -1)).toBe(2);
  });

  it("has nothing to step to when there are no matches", () => {
    expect(stepMatch(0, -1, 1)).toBe(-1);
  });
});

describe("matchNearestTo", () => {
  const matches = [
    { start: 10, end: 14 },
    { start: 40, end: 44 },
    { start: 90, end: 94 },
  ];

  it("keeps the reader where they are: the first match at or after the anchor", () => {
    expect(matchNearestTo(matches, 20)).toBe(1);
    expect(matchNearestTo(matches, 40)).toBe(1);
  });

  it("wraps to the first match when the anchor is past the last one", () => {
    expect(matchNearestTo(matches, 500)).toBe(0);
  });

  it("returns nothing to land on when there are no matches", () => {
    expect(matchNearestTo([], 0)).toBe(-1);
  });
});
