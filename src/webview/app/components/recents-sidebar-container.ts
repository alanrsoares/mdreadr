import { defineContainer, storageSet } from "@re-reduced/react";
import { readStoredJson } from "../state/storage.ts";

export const STORAGE_KEY = "mdreadr-recents-sidebar-collapsed";

/** Accepts both the JSON the interpreter writes and the `"true"`/`"false"`
 *  strings written before persistence moved into the container. */
export function parseStoredCollapsed(raw: unknown): boolean {
  return raw === true || raw === "true";
}

export const recentsSidebarContainer = defineContainer("recents-sidebar", {
  state: { isCollapsed: readStoredJson(STORAGE_KEY, parseStoredCollapsed) },
  actions: (on) => ({
    collapsedChanged: on<boolean>((_s, isCollapsed) => ({ isCollapsed })),
    collapsedToggled: on((s) => ({ isCollapsed: !s.isCollapsed })),
  }),
  effects: (fx) => [
    fx.onChange(
      (s) => s.isCollapsed.value,
      (isCollapsed) => storageSet(STORAGE_KEY, isCollapsed),
    ),
  ],
});
