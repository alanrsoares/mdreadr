import { describe, expect, it } from "bun:test";
import { getEditorFontFamilyCss, getReaderFontFamilyCss } from "./FontSettingsContext.tsx";
import {
  clampFontSize,
  DEFAULT_FONT_SETTINGS,
  fontSettingsContainer,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  parseStoredFontSettings,
} from "./font-settings-container.ts";

describe("fontSettingsContainer", () => {
  it("has expected default font settings", () => {
    expect(DEFAULT_FONT_SETTINGS).toEqual({
      readerFontSize: 17,
      readerFontFamily: "serif",
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

  it("clamps font size between MIN_FONT_SIZE (12) and MAX_FONT_SIZE (24)", () => {
    expect(clampFontSize(10)).toBe(MIN_FONT_SIZE);
    expect(clampFontSize(12)).toBe(12);
    expect(clampFontSize(18)).toBe(18);
    expect(clampFontSize(24)).toBe(24);
    expect(clampFontSize(30)).toBe(MAX_FONT_SIZE);
  });

  it("parses valid stored font settings and applies boundaries", () => {
    const valid = parseStoredFontSettings(
      JSON.stringify({
        readerFontSize: 20,
        readerFontFamily: "sans",
        editorFontSize: 16,
        editorFontFamily: "sans",
      }),
    );
    expect(valid).toEqual({
      readerFontSize: 20,
      readerFontFamily: "sans",
      editorFontSize: 16,
      editorFontFamily: "sans",
    });

    const outOfBounds = parseStoredFontSettings(
      JSON.stringify({
        readerFontSize: 50,
        editorFontSize: 5,
      }),
    );
    expect(outOfBounds.readerFontSize).toBe(MAX_FONT_SIZE);
    expect(outOfBounds.editorFontSize).toBe(MIN_FONT_SIZE);
  });

  it("falls back to default font settings on null or invalid JSON", () => {
    expect(parseStoredFontSettings(null)).toEqual(DEFAULT_FONT_SETTINGS);
    expect(parseStoredFontSettings("invalid-json")).toEqual(DEFAULT_FONT_SETTINGS);
  });
});
