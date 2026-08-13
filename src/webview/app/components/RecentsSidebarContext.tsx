import { createContainerContext, useWatch } from "@re-reduced/react";
import type { WithChildren } from "../types.ts";
import {
  persistCollapsedPreference,
  recentsSidebarContainer,
} from "./recents-sidebar-container.ts";

export const RecentsSidebarStore = createContainerContext(recentsSidebarContainer);

export function RecentsSidebarProvider({ children }: WithChildren) {
  return (
    <RecentsSidebarStore.Provider>
      <RecentsSidebarWatcher>{children}</RecentsSidebarWatcher>
    </RecentsSidebarStore.Provider>
  );
}

function RecentsSidebarWatcher({ children }: WithChildren) {
  const store = RecentsSidebarStore.use();
  useWatch(store, (s) => s.isCollapsed.value, persistCollapsedPreference);
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
