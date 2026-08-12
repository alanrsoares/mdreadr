import { defineContainer } from "@re-reduced/react";

export type ReaderFontFamily = "serif" | "sans" | "mono";
export type EditorFontFamily = "mono" | "sans";

export type FontSettings = {
  readerFontSize: number;
  readerFontFamily: ReaderFontFamily;
  editorFontSize: number;
  editorFontFamily: EditorFontFamily;
};

export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 24;

export function clampFontSize(size: number): number {
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
}

const STORAGE_KEY = "mdreadr-font-settings";

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  readerFontSize: 17,
  readerFontFamily: "serif",
  editorFontSize: 15,
  editorFontFamily: "mono",
};

export function parseStoredFontSettings(stored: string | null): FontSettings {
  if (!stored) return DEFAULT_FONT_SETTINGS;
  try {
    const parsed = JSON.parse(stored);
    return {
      readerFontSize:
        typeof parsed.readerFontSize === "number"
          ? clampFontSize(parsed.readerFontSize)
          : DEFAULT_FONT_SETTINGS.readerFontSize,
      readerFontFamily:
        parsed.readerFontFamily === "serif" ||
        parsed.readerFontFamily === "sans" ||
        parsed.readerFontFamily === "mono"
          ? parsed.readerFontFamily
          : DEFAULT_FONT_SETTINGS.readerFontFamily,
      editorFontSize:
        typeof parsed.editorFontSize === "number"
          ? clampFontSize(parsed.editorFontSize)
          : DEFAULT_FONT_SETTINGS.editorFontSize,
      editorFontFamily:
        parsed.editorFontFamily === "mono" || parsed.editorFontFamily === "sans"
          ? parsed.editorFontFamily
          : DEFAULT_FONT_SETTINGS.editorFontFamily,
    };
  } catch {
    return DEFAULT_FONT_SETTINGS;
  }
}

function readStoredFontSettings(): FontSettings {
  try {
    return parseStoredFontSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_FONT_SETTINGS;
  }
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
    readerFontSizeChanged: on<number>((s, size) => ({
      ...s,
      readerFontSize: clampFontSize(size),
    })),
    readerFontFamilyChanged: on<ReaderFontFamily>((s, readerFontFamily) => ({
      ...s,
      readerFontFamily,
    })),
    editorFontSizeChanged: on<number>((s, size) => ({
      ...s,
      editorFontSize: clampFontSize(size),
    })),
    editorFontFamilyChanged: on<EditorFontFamily>((s, editorFontFamily) => ({
      ...s,
      editorFontFamily,
    })),
    resetDefaults: on(() => DEFAULT_FONT_SETTINGS),
  }),
});
