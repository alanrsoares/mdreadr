import { describe, expect, it } from "bun:test";
import { getEditorFontFamilyCss, getReaderFontFamilyCss } from "./FontSettingsContext.tsx";
import {
  clampFontSize,
  clampLineHeight,
  DEFAULT_FONT_SETTINGS,
  fontSettingsContainer,
  MAX_FONT_SIZE,
  MAX_LINE_HEIGHT,
  MIN_FONT_SIZE,
  MIN_LINE_HEIGHT,
  parseStoredFontSettings,
} from "./font-settings-container.ts";

describe("fontSettingsContainer", () => {
  it("has expected default font settings", () => {
    expect(DEFAULT_FONT_SETTINGS).toEqual({
      readerFontSize: 17,
      readerFontFamily: "serif",
      readerLineHeight: 1.7,
      editorFontSize: 15,
      editorFontFamily: "mono",
    });
  });

  it("returns appropriate font family CSS for reader families", () => {
    expect(getReaderFontFamilyCss("serif")).toContain("Source Serif 4");
    expect(getReaderFontFamilyCss("sans")).toContain("Figtree");
    expect(getReaderFontFamilyCss("mono")).toContain("ui-monospace");
  });

  it("returns appropriate font family CSS for editor families", () => {
    expect(getEditorFontFamilyCss("mono")).toContain("ui-monospace");
    expect(getEditorFontFamilyCss("sans")).toContain("Figtree");
  });

  it("defines fontSettingsContainer with correct name and state", () => {
    expect(fontSettingsContainer.name).toBe("font-settings");
    expect(fontSettingsContainer.state).toEqual(DEFAULT_FONT_SETTINGS);
  });

  it("clamps font size between MIN_FONT_SIZE and MAX_FONT_SIZE", () => {
    expect(clampFontSize(10)).toBe(MIN_FONT_SIZE);
    expect(clampFontSize(12)).toBe(12);
    expect(clampFontSize(18)).toBe(18);
    expect(clampFontSize(MAX_FONT_SIZE)).toBe(MAX_FONT_SIZE);
    expect(clampFontSize(MAX_FONT_SIZE + 6)).toBe(MAX_FONT_SIZE);
  });

  it("falls back to the minimum for non-finite font sizes", () => {
    expect(clampFontSize(Number.NaN)).toBe(MIN_FONT_SIZE);
    expect(clampFontSize(Number.POSITIVE_INFINITY)).toBe(MIN_FONT_SIZE);
  });

  it("clamps line height and snaps it to the slider step", () => {
    expect(clampLineHeight(1.0)).toBe(MIN_LINE_HEIGHT);
    expect(clampLineHeight(3)).toBe(MAX_LINE_HEIGHT);
    expect(clampLineHeight(1.73)).toBeCloseTo(1.75, 5);
    expect(clampLineHeight(Number.NaN)).toBe(MIN_LINE_HEIGHT);
  });

  it("parses valid stored font settings and applies boundaries", () => {
    const valid = parseStoredFontSettings(
      JSON.stringify({
        readerFontSize: 20,
        readerFontFamily: "sans",
        readerLineHeight: 1.5,
        editorFontSize: 16,
        editorFontFamily: "sans",
      }),
    );
    expect(valid).toEqual({
      readerFontSize: 20,
      readerFontFamily: "sans",
      readerLineHeight: 1.5,
      editorFontSize: 16,
      editorFontFamily: "sans",
    });

    const outOfBounds = parseStoredFontSettings(
      JSON.stringify({
        readerFontSize: 500,
        editorFontSize: 5,
        readerLineHeight: 9,
      }),
    );
    expect(outOfBounds.readerFontSize).toBe(MAX_FONT_SIZE);
    expect(outOfBounds.editorFontSize).toBe(MIN_FONT_SIZE);
    expect(outOfBounds.readerLineHeight).toBe(MAX_LINE_HEIGHT);
  });

  it("keeps settings written by an older version readable", () => {
    // Pre-line-height payload — must gain the default, not undefined.
    const legacy = parseStoredFontSettings(
      JSON.stringify({ readerFontSize: 18, readerFontFamily: "mono" }),
    );
    expect(legacy.readerLineHeight).toBe(DEFAULT_FONT_SETTINGS.readerLineHeight);
    expect(legacy.readerFontSize).toBe(18);
  });

  it("falls back to default font settings on null or invalid JSON", () => {
    expect(parseStoredFontSettings(null)).toEqual(DEFAULT_FONT_SETTINGS);
    expect(parseStoredFontSettings("invalid-json")).toEqual(DEFAULT_FONT_SETTINGS);
  });
});
