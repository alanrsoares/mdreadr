import { describe, expect, it } from "bun:test";
import { locateSpan } from "./find-highlight.ts";

const chunks = [{ length: 10 }, { length: 5 }, { length: 8 }];

describe("locateSpan", () => {
  it("maps a match inside one text run", () => {
    expect(locateSpan(chunks, { start: 2, end: 6 })).toEqual({
      start: { chunk: 0, offset: 2 },
      end: { chunk: 0, offset: 6 },
    });
  });

  it("maps a match that runs across text runs, as `**bold** text` renders", () => {
    expect(locateSpan(chunks, { start: 8, end: 12 })).toEqual({
      start: { chunk: 0, offset: 8 },
      end: { chunk: 1, offset: 2 },
    });
  });

  it("keeps an end landing on a boundary in the run that ends there", () => {
    expect(locateSpan(chunks, { start: 6, end: 10 })?.end).toEqual({ chunk: 0, offset: 10 });
  });

  it("maps into the last run", () => {
    expect(locateSpan(chunks, { start: 16, end: 20 })).toEqual({
      start: { chunk: 2, offset: 1 },
      end: { chunk: 2, offset: 5 },
    });
  });

  it("gives up on a range past the end of the text", () => {
    expect(locateSpan(chunks, { start: 40, end: 44 })).toBeNull();
  });

  it("gives up when there is no text at all", () => {
    expect(locateSpan([], { start: 0, end: 1 })).toBeNull();
  });
});
