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
import type { SVGProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDisplayPath } from "./display-path.ts";
import { formatRecentMenuLabels } from "./recent-path-labels.ts";

const RECENTS_SIDEBAR_COLLAPSED_KEY = "mdreadr-recents-sidebar-collapsed";

function DocumentTextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; item label names the file
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125V5.25a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 4.5v15.75a2.25 2.25 0 0 0 2.25 2.25h10.5A2.25 2.25 0 0 0 19.5 19.5V14.25Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.25 5.25v5.25a2.25 2.25 0 0 0 2.25 2.25h5.25"
      />
    </svg>
  );
}

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

  if (isCollapsed) {
    return (
      <IconButton
        label="Open markdown…"
        tooltip="Open markdown…"
        variant="primary"
        size="sm"
        icon={<Icon icon={DocumentTextIcon} size="sm" />}
        isLoading={isOpening}
        onClick={onPickDocument}
      />
    );
  }

  return (
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

function RecentSideNavItem({
  menuLabel,
  displayPath,
  isSelected,
  onOpen,
}: RecentSideNavItemProps) {
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
        <Tooltip
          content={displayPath}
          placement="end"
          alignment="start"
          anchorRef={anchorRef}
        />
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
          <SideNavItem
            label="No recent files"
            icon={DocumentTextIcon}
            isDisabled
          />
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
