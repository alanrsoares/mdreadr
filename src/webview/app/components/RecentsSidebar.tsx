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
import { useMemo, useRef } from "react";
import { DocumentTextIcon } from "../icons.ts";
import { formatDisplayPath, formatRecentMenuLabels, pathFileName } from "./path-display.ts";
import { useRecentsSidebar } from "./RecentsSidebarContext.tsx";

type OpenActionVariant = "primary" | "secondary";

type RecentsSidebarOpenActionProps = {
  onPickDocument: () => void;
  isOpening: boolean;
  variant: OpenActionVariant;
};

function RecentsSidebarOpenAction({
  onPickDocument,
  isOpening,
  variant,
}: RecentsSidebarOpenActionProps) {
  const { isCollapsed } = useSideNavCollapse();

  return isCollapsed ? (
    <IconButton
      label="Open markdown…"
      tooltip="Open markdown…"
      variant={variant}
      size="sm"
      icon={<Icon icon={DocumentTextIcon} size="sm" />}
      isLoading={isOpening}
      onClick={onPickDocument}
    />
  ) : (
    <Button
      label="Open markdown…"
      variant={variant}
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
  /**
   * Demoted to secondary while the app is empty, so the centred CTA in
   * ReaderPage is the only primary action on screen.
   */
  openActionVariant?: OpenActionVariant;
};

export function RecentsSidebar({
  paths,
  selectedPath,
  homeDirectory,
  onOpen,
  onPickDocument,
  isOpening = false,
  openActionVariant = "primary",
}: RecentsSidebarProps) {
  const { isCollapsed, setCollapsed } = useRecentsSidebar();

  const menuLabels = useMemo(() => formatRecentMenuLabels(paths), [paths]);
  const displayPaths = useMemo(
    () => new Map(paths.map((path) => [path, formatDisplayPath(path, homeDirectory)])),
    [paths, homeDirectory],
  );

  return (
    <SideNav
      collapsible={{
        isCollapsed,
        onCollapsedChange: setCollapsed,
        hasButton: true,
      }}
      resizable={{
        autoSaveId: "mdreadr-recents-sidebar",
        defaultWidth: 260,
        minWidth: 200,
        maxWidth: 360,
      }}
      topContent={
        <RecentsSidebarOpenAction
          onPickDocument={onPickDocument}
          isOpening={isOpening}
          variant={openActionVariant}
        />
      }
    >
      <SideNavSection title="Recents">
        {paths.length === 0 ? (
          <SideNavItem label="No recent files" icon={DocumentTextIcon} isDisabled />
        ) : (
          paths.map((path) => {
            const { menuLabel } = menuLabels.get(path) ?? {
              menuLabel: pathFileName(path),
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
