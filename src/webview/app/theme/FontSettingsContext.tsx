import { createContainerContext } from "@re-reduced/react";
import { useCallback } from "react";
import { storageInterpreters, useStorageSync } from "../state/storage.ts";
import type { WithChildren } from "../types.ts";
import {
  type EditorFontFamily,
  type FontSettings,
  fontSettingsContainer,
  parseStoredFontSettings,
  type ReaderFontFamily,
  STORAGE_KEY,
} from "./font-settings-container.ts";

export type { EditorFontFamily, FontSettings, ReaderFontFamily };

// Writes are declared by the container's `effects`; this registry executes them.
const FontSettingsStore = createContainerContext(fontSettingsContainer, {
  interpreters: storageInterpreters,
});

export const FontSettingsProvider = ({ children }: WithChildren) => (
  <FontSettingsStore.Provider>
    <FontSettingsWatcher>{children}</FontSettingsWatcher>
  </FontSettingsStore.Provider>
);

function FontSettingsWatcher({ children }: WithChildren) {
  const { settingsReplaced } = FontSettingsStore.useContainer();
  useStorageSync(
    STORAGE_KEY,
    useCallback((raw) => settingsReplaced(parseStoredFontSettings(raw)), [settingsReplaced]),
  );
  return children;
}

export function useFontSettings() {
  const container = FontSettingsStore.useContainer();
  return {
    readerFontSize: container.readerFontSize,
    readerFontFamily: container.readerFontFamily,
    readerLineHeight: container.readerLineHeight,
    editorFontSize: container.editorFontSize,
    editorFontFamily: container.editorFontFamily,
    setReaderFontSize: container.readerFontSizeChanged,
    setReaderFontFamily: container.readerFontFamilyChanged,
    setReaderLineHeight: container.readerLineHeightChanged,
    setEditorFontSize: container.editorFontSizeChanged,
    setEditorFontFamily: container.editorFontFamilyChanged,
    resetDefaults: container.resetDefaults,
  };
}

export function getReaderFontFamilyCss(family: ReaderFontFamily): string {
  switch (family) {
    case "sans":
      return 'Figtree, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    case "mono":
      return 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
    default:
      return '"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
  }
}

export function getEditorFontFamilyCss(family: EditorFontFamily): string {
  switch (family) {
    case "sans":
      return 'Figtree, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    default:
      return 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
  }
}
