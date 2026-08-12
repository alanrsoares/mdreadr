import { createContainerContext, useWatch } from "@re-reduced/react";
import type { WithChildren } from "../types.ts";
import {
  type EditorFontFamily,
  type FontSettings,
  fontSettingsContainer,
  persistFontSettings,
  type ReaderFontFamily,
} from "./font-settings-container.ts";

export type { EditorFontFamily, FontSettings, ReaderFontFamily };

const FontSettingsStore = createContainerContext(fontSettingsContainer);

export const FontSettingsProvider = ({ children }: WithChildren) => (
  <FontSettingsStore.Provider>
    <FontSettingsWatcher>{children}</FontSettingsWatcher>
  </FontSettingsStore.Provider>
);

function FontSettingsWatcher({ children }: WithChildren) {
  const store = FontSettingsStore.use();
  useWatch(
    store,
    (s) => ({
      readerFontSize: s.readerFontSize.value,
      readerFontFamily: s.readerFontFamily.value,
      editorFontSize: s.editorFontSize.value,
      editorFontFamily: s.editorFontFamily.value,
    }),
    persistFontSettings,
  );
  return children;
}

export function useFontSettings() {
  const container = FontSettingsStore.useContainer();
  return {
    readerFontSize: container.readerFontSize,
    readerFontFamily: container.readerFontFamily,
    editorFontSize: container.editorFontSize,
    editorFontFamily: container.editorFontFamily,
    setReaderFontSize: container.readerFontSizeChanged,
    setReaderFontFamily: container.readerFontFamilyChanged,
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
