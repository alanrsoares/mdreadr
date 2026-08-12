import { describe, expect, it } from "bun:test";
import { getEditorFontFamilyCss, getReaderFontFamilyCss } from "./FontSettingsContext.tsx";
import { DEFAULT_FONT_SETTINGS, fontSettingsContainer } from "./font-settings-container.ts";

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
});
