import { createContainerContext } from "@re-reduced/react";
import { useCallback } from "react";
import { decodeStored, storageInterpreters, useStorageSync } from "../state/storage.ts";
import type { WithChildren } from "../types.ts";
import {
  parseStoredCollapsed,
  recentsSidebarContainer,
  STORAGE_KEY,
} from "./recents-sidebar-container.ts";

export const RecentsSidebarStore = createContainerContext(recentsSidebarContainer, {
  interpreters: storageInterpreters,
});

export const RecentsSidebarProvider = ({ children }: WithChildren) => (
  <RecentsSidebarStore.Provider>
    <RecentsSidebarWatcher>{children}</RecentsSidebarWatcher>
  </RecentsSidebarStore.Provider>
);

function RecentsSidebarWatcher({ children }: WithChildren) {
  const { collapsedChanged } = RecentsSidebarStore.useContainer();
  useStorageSync(
    STORAGE_KEY,
    useCallback(
      (raw) => collapsedChanged(decodeStored(raw, parseStoredCollapsed)),
      [collapsedChanged],
    ),
  );
  return children;
}

export function useRecentsSidebar() {
  const container = RecentsSidebarStore.useContainer();
  return {
    isCollapsed: container.isCollapsed,
    setCollapsed: container.collapsedChanged,
    toggleCollapsed: container.collapsedToggled,
  };
}
