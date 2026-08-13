import { defineContainer, storageSet } from "@re-reduced/react";

export type ReaderFontFamily = "serif" | "sans" | "mono";
export type EditorFontFamily = "mono" | "sans";

export type FontSettings = {
  readerFontSize: number;
  readerFontFamily: ReaderFontFamily;
  readerLineHeight: number;
  editorFontSize: number;
  editorFontFamily: EditorFontFamily;
};

export const MIN_FONT_SIZE = 12;
/** ~200% of the 17px default, so low-vision readers aren't capped short. */
export const MAX_FONT_SIZE = 34;
export const FONT_SIZE_STEP = 1;

export const MIN_LINE_HEIGHT = 1.3;
export const MAX_LINE_HEIGHT = 2.2;
export const LINE_HEIGHT_STEP = 0.05;

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function clampFontSize(size: number): number {
  return clampNumber(size, MIN_FONT_SIZE, MAX_FONT_SIZE);
}

export function clampLineHeight(leading: number): number {
  // Round to the slider step so drags can't persist float noise (1.7000000000000002).
  const clamped = clampNumber(leading, MIN_LINE_HEIGHT, MAX_LINE_HEIGHT);
  return Math.round(clamped / LINE_HEIGHT_STEP) * LINE_HEIGHT_STEP;
}

export const STORAGE_KEY = "mdreadr-font-settings";

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  readerFontSize: 17,
  readerFontFamily: "serif",
  readerLineHeight: 1.7,
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
      readerLineHeight:
        typeof parsed.readerLineHeight === "number"
          ? clampLineHeight(parsed.readerLineHeight)
          : DEFAULT_FONT_SETTINGS.readerLineHeight,
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

export function readStoredFontSettings(): FontSettings {
  try {
    return parseStoredFontSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_FONT_SETTINGS;
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
    readerLineHeightChanged: on<number>((s, leading) => ({
      ...s,
      readerLineHeight: clampLineHeight(leading),
    })),
    editorFontSizeChanged: on<number>((s, size) => ({
      ...s,
      editorFontSize: clampFontSize(size),
    })),
    editorFontFamilyChanged: on<EditorFontFamily>((s, editorFontFamily) => ({
      ...s,
      editorFontFamily,
    })),
    /** Adopt settings written by another window (storage event). */
    settingsReplaced: on<FontSettings>((_s, next) => next),
    resetDefaults: on(() => DEFAULT_FONT_SETTINGS),
  }),
  effects: (fx) => [
    fx.onChange(
      (s): FontSettings => ({
        readerFontSize: s.readerFontSize.value,
        readerFontFamily: s.readerFontFamily.value,
        readerLineHeight: s.readerLineHeight.value,
        editorFontSize: s.editorFontSize.value,
        editorFontFamily: s.editorFontFamily.value,
      }),
      (settings) => storageSet(STORAGE_KEY, settings),
    ),
  ],
});
