import { defineContainer } from "@re-reduced/react";

const STORAGE_KEY = "mdreadr-recents-sidebar-collapsed";

function readCollapsedPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // ignore storage errors
  }
  return true;
}

export function persistCollapsedPreference(isCollapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  } catch {
    // ignore storage errors
  }
}

export const recentsSidebarContainer = defineContainer("recents-sidebar", {
  state: { isCollapsed: readCollapsedPreference() },
  actions: (on) => ({
    collapsedChanged: on<boolean>((_s, isCollapsed) => ({ isCollapsed })),
  }),
});
