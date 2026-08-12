import { defineContainer } from "@re-reduced/react";

export type ReaderFontFamily = "serif" | "sans" | "mono";
export type EditorFontFamily = "mono" | "sans";

export type FontSettings = {
  readerFontSize: number;
  readerFontFamily: ReaderFontFamily;
  editorFontSize: number;
  editorFontFamily: EditorFontFamily;
};

const STORAGE_KEY = "mdreadr-font-settings";

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  readerFontSize: 17,
  readerFontFamily: "serif",
  editorFontSize: 15,
  editorFontFamily: "mono",
};

function readStoredFontSettings(): FontSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        readerFontSize:
          typeof parsed.readerFontSize === "number" &&
          parsed.readerFontSize >= 12 &&
          parsed.readerFontSize <= 24
            ? parsed.readerFontSize
            : DEFAULT_FONT_SETTINGS.readerFontSize,
        readerFontFamily:
          parsed.readerFontFamily === "serif" ||
          parsed.readerFontFamily === "sans" ||
          parsed.readerFontFamily === "mono"
            ? parsed.readerFontFamily
            : DEFAULT_FONT_SETTINGS.readerFontFamily,
        editorFontSize:
          typeof parsed.editorFontSize === "number" &&
          parsed.editorFontSize >= 12 &&
          parsed.editorFontSize <= 24
            ? parsed.editorFontSize
            : DEFAULT_FONT_SETTINGS.editorFontSize,
        editorFontFamily:
          parsed.editorFontFamily === "mono" || parsed.editorFontFamily === "sans"
            ? parsed.editorFontFamily
            : DEFAULT_FONT_SETTINGS.editorFontFamily,
      };
    }
  } catch {
    // Fall back on storage error
  }
  return DEFAULT_FONT_SETTINGS;
}

export function persistFontSettings(settings: FontSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failure
  }
}

export const fontSettingsContainer = defineContainer("font-settings", {
  state: readStoredFontSettings(),
  actions: (on) => ({
    readerFontSizeChanged: on<number>((s, readerFontSize) => ({ ...s, readerFontSize })),
    readerFontFamilyChanged: on<ReaderFontFamily>((s, readerFontFamily) => ({
      ...s,
      readerFontFamily,
    })),
    editorFontSizeChanged: on<number>((s, editorFontSize) => ({ ...s, editorFontSize })),
    editorFontFamilyChanged: on<EditorFontFamily>((s, editorFontFamily) => ({
      ...s,
      editorFontFamily,
    })),
    resetDefaults: on(() => DEFAULT_FONT_SETTINGS),
  }),
});
