import type { ReaderFontFamily } from "./font-settings-container.ts";

/** Measure per prose family, in ems of the reader font size, so line length
 *  stays ~constant in characters across the size range. Measured in headless
 *  Chrome (12/17/22/28/34px, 1.7 leading): each value lands 65-75 characters
 *  per line. Mono needs a wider column because its average glyph is ~0.62em
 *  against ~0.47em for the serif and sans faces. */
const MEASURE_EMS: Record<ReaderFontFamily, number> = {
  serif: 33,
  sans: 33,
  mono: 44,
};

/** The measure in px. Published as `--reader-measure` on the reader sheet: the
 *  prose blocks cap themselves with it, and the sheet grows to fit it so the
 *  character count holds at large reader font sizes. */
export const getReaderMeasurePx = (fontSize: number, family: ReaderFontFamily): number =>
  Math.round(fontSize * MEASURE_EMS[family]);
