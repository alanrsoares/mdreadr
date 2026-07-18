import { Theme } from "@astryxdesign/core/theme";
import { createContainerContext, useWatch } from "@re-reduced/react";
import type { ReactNode } from "react";
import { colorSchemeContainer, persistColorScheme } from "./color-scheme-container.ts";
import { mdreadrTheme } from "./mdreadr.js";

export type { ColorScheme } from "./color-scheme-container.ts";

const ColorSchemeStore = createContainerContext(colorSchemeContainer);

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  return (
    <ColorSchemeStore.Provider>
      <ColorSchemeThemed>{children}</ColorSchemeThemed>
    </ColorSchemeStore.Provider>
  );
}

function ColorSchemeThemed({ children }: { children: ReactNode }) {
  const store = ColorSchemeStore.use();
  const colorScheme = ColorSchemeStore.useSelect((s) => s.colorScheme.value);
  useWatch(store, (s) => s.colorScheme.value, persistColorScheme);

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
