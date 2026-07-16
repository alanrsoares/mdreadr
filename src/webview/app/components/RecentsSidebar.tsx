import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import {
  SideNav,
  SideNavItem,
  SideNavSection,
  useSideNavCollapse,
} from "@astryxdesign/core/SideNav";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { useEffect, useMemo, useRef, useState } from "react";
import { DocumentTextIcon } from "../icons.ts";
import { formatDisplayPath } from "./display-path.ts";
import { formatRecentMenuLabels } from "./recent-path-labels.ts";

const RECENTS_SIDEBAR_COLLAPSED_KEY = "mdreadr-recents-sidebar-collapsed";

function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts.at(-1) ?? path;
}

function readCollapsedPreference(): boolean {
  try {
    const stored = localStorage.getItem(RECENTS_SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // ignore storage errors
  }
  return true;
}

type RecentsSidebarOpenActionProps = {
  onPickDocument: () => void;
  isOpening: boolean;
};

function RecentsSidebarOpenAction({ onPickDocument, isOpening }: RecentsSidebarOpenActionProps) {
  const { isCollapsed } = useSideNavCollapse();

  return isCollapsed ? (
    <IconButton
      label="Open markdown…"
      tooltip="Open markdown…"
      variant="primary"
      size="sm"
      icon={<Icon icon={DocumentTextIcon} size="sm" />}
      isLoading={isOpening}
      onClick={onPickDocument}
    />
  ) : (
    <Button
      label="Open markdown…"
      variant="primary"
      isLoading={isOpening}
      onClick={onPickDocument}
    />
  );
}

type RecentSideNavItemProps = {
  menuLabel: string;
  displayPath: string;
  isSelected: boolean;
  onOpen: () => void;
};

function RecentSideNavItem({ menuLabel, displayPath, isSelected, onOpen }: RecentSideNavItemProps) {
  const { isCollapsed } = useSideNavCollapse();
  const anchorRef = useRef<HTMLDivElement>(null);
  const itemLabel = isCollapsed ? displayPath : menuLabel;

  return (
    <div ref={anchorRef} style={{ width: "100%" }}>
      <SideNavItem
        label={itemLabel}
        icon={DocumentTextIcon}
        selectedIcon={DocumentTextIcon}
        isSelected={isSelected}
        onClick={onOpen}
      />
      {!isCollapsed && displayPath !== menuLabel ? (
        <Tooltip content={displayPath} placement="end" alignment="start" anchorRef={anchorRef} />
      ) : null}
    </div>
  );
}

type RecentsSidebarProps = {
  paths: string[];
  selectedPath?: string;
  homeDirectory?: string;
  onOpen: (path: string) => void;
  onPickDocument: () => void;
  isOpening?: boolean;
};

export function RecentsSidebar({
  paths,
  selectedPath,
  homeDirectory,
  onOpen,
  onPickDocument,
  isOpening = false,
}: RecentsSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsedPreference);
  const menuLabels = useMemo(() => formatRecentMenuLabels(paths), [paths]);
  const displayPaths = useMemo(
    () => new Map(paths.map((path) => [path, formatDisplayPath(path, homeDirectory)])),
    [paths, homeDirectory],
  );

  useEffect(() => {
    try {
      localStorage.setItem(RECENTS_SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch {
      // ignore storage errors
    }
  }, [isCollapsed]);

  return (
    <SideNav
      collapsible={{
        isCollapsed,
        onCollapsedChange: setIsCollapsed,
      }}
      resizable={{
        autoSaveId: "mdreadr-recents-sidebar",
        defaultWidth: 260,
        minWidth: 200,
        maxWidth: 360,
      }}
      topContent={
        <RecentsSidebarOpenAction onPickDocument={onPickDocument} isOpening={isOpening} />
      }
    >
      <SideNavSection title="Recents">
        {paths.length === 0 ? (
          <SideNavItem label="No recent files" icon={DocumentTextIcon} isDisabled />
        ) : (
          paths.map((path) => {
            const { menuLabel } = menuLabels.get(path) ?? {
              menuLabel: fileName(path),
              ariaLabel: path,
            };

            return (
              <RecentSideNavItem
                key={path}
                menuLabel={menuLabel}
                displayPath={displayPaths.get(path) ?? menuLabel}
                isSelected={path === selectedPath}
                onOpen={() => onOpen(path)}
              />
            );
          })
        )}
      </SideNavSection>
    </SideNav>
  );
}

export { fileName as pathFileName };
