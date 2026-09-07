import { describe, expect, it } from "bun:test";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "./font-settings-container.ts";
import { getReaderMeasurePx } from "./measure.ts";

describe("getReaderMeasurePx", () => {
  it("scales with the reader font size", () => {
    expect(getReaderMeasurePx(17, "serif")).toBe(561);
    expect(getReaderMeasurePx(34, "serif")).toBe(1122);
  });

  it("gives mono a wider column, since its average glyph is wider", () => {
    expect(getReaderMeasurePx(17, "mono")).toBeGreaterThan(getReaderMeasurePx(17, "sans"));
  });

  it("keeps the measured 65-75 character band across the font size range", () => {
    // Average glyph width per family, in ems, measured in headless Chrome.
    const emsPerChar = { serif: 0.475, sans: 0.472, mono: 0.623 } as const;

    for (const [family, perChar] of Object.entries(emsPerChar)) {
      for (const size of [MIN_FONT_SIZE, 17, 22, 28, MAX_FONT_SIZE]) {
        const chars =
          getReaderMeasurePx(size, family as keyof typeof emsPerChar) / (size * perChar);
        expect(chars).toBeGreaterThanOrEqual(65);
        expect(chars).toBeLessThanOrEqual(75);
      }
    }
  });
});
