import { defineContainer, storageSet } from "@re-reduced/react";
import { readStoredJson } from "../state/storage.ts";

export type ColorScheme = "light" | "dark";

export const STORAGE_KEY = "mdreadr-color-scheme";

/** Accepts both the JSON the interpreter writes and the bare `dark` written
 *  before persistence moved into the container. */
export function parseStoredColorScheme(raw: unknown): ColorScheme {
  return raw === "light" || raw === "dark" ? raw : "dark";
}

export const colorSchemeContainer = defineContainer("color-scheme", {
  state: { colorScheme: readStoredJson(STORAGE_KEY, parseStoredColorScheme) },
  actions: (on) => ({
    colorSchemeChanged: on<ColorScheme>((_s, colorScheme) => ({ colorScheme })),
  }),
  effects: (fx) => [
    fx.onChange(
      (s) => s.colorScheme.value,
      (colorScheme) => storageSet(STORAGE_KEY, colorScheme),
    ),
  ],
});
