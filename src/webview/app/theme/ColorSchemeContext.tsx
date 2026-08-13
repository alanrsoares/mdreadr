import { Theme } from "@astryxdesign/core/theme";
import { createContainerContext } from "@re-reduced/react";
import { useCallback } from "react";
import { decodeStored, storageInterpreters, useStorageSync } from "../state/storage.ts";
import type { WithChildren } from "../types.ts";
import {
  colorSchemeContainer,
  parseStoredColorScheme,
  STORAGE_KEY,
} from "./color-scheme-container.ts";
import { mdreadrTheme } from "./mdreadr.js";

export type { ColorScheme } from "./color-scheme-container.ts";

const ColorSchemeStore = createContainerContext(colorSchemeContainer, {
  interpreters: storageInterpreters,
});

export const ColorSchemeProvider = ({ children }: WithChildren) => (
  <ColorSchemeStore.Provider>
    <ColorSchemeThemed>{children}</ColorSchemeThemed>
  </ColorSchemeStore.Provider>
);

function ColorSchemeThemed({ children }: WithChildren) {
  const { colorScheme, colorSchemeChanged } = ColorSchemeStore.useContainer();
  useStorageSync(
    STORAGE_KEY,
    useCallback(
      (raw) => colorSchemeChanged(decodeStored(raw, parseStoredColorScheme)),
      [colorSchemeChanged],
    ),
  );

  return (
    <Theme theme={mdreadrTheme} mode={colorScheme}>
      {children}
    </Theme>
  );
}

export function useColorScheme() {
  const { colorScheme, colorSchemeChanged } = ColorSchemeStore.useContainer();
  return { colorScheme, setColorScheme: colorSchemeChanged };
}
