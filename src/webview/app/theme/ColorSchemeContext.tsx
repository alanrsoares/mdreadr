import { Theme } from "@astryxdesign/core/theme";
import { createContainerContext, useWatch } from "@re-reduced/react";
import type { WithChildren } from "../types.ts";
import { colorSchemeContainer, persistColorScheme } from "./color-scheme-container.ts";
import { mdreadrTheme } from "./mdreadr.js";

export type { ColorScheme } from "./color-scheme-container.ts";

const ColorSchemeStore = createContainerContext(colorSchemeContainer);

export function ColorSchemeProvider({ children }: WithChildren) {
  return (
    <ColorSchemeStore.Provider>
      <ColorSchemeThemed>{children}</ColorSchemeThemed>
    </ColorSchemeStore.Provider>
  );
}

function ColorSchemeThemed({ children }: WithChildren) {
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
