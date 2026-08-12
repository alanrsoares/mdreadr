import { defineContainer } from "@re-reduced/react";

export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "mdreadr-color-scheme";

function readStoredColorScheme(): ColorScheme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

export function persistColorScheme(colorScheme: ColorScheme): void {
  localStorage.setItem(STORAGE_KEY, colorScheme);
}

export const colorSchemeContainer = defineContainer("color-scheme", {
  state: { colorScheme: readStoredColorScheme() },
  actions: (on) => ({
    colorSchemeChanged: on<ColorScheme>((_s, colorScheme) => ({ colorScheme })),
  }),
});
