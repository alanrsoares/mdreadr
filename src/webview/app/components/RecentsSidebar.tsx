import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import {
  SideNav,
  SideNavCollapseButton,
  SideNavItem,
  SideNavSection,
  useSideNavCollapse,
} from "@astryxdesign/core/SideNav";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { useMemo, useRef } from "react";
import packageJson from "../../../../package.json";
import { useCopy } from "../hooks/useCopy.ts";
import { DocumentTextIcon } from "../icons.ts";
import { RecentItemActions, RecentItemRow } from "../ui/layout.tsx";
import { fileIcon } from "./file-icons.ts";
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
      label="Open…"
      tooltip="Open…"
      variant={variant}
      size="sm"
      icon={<Icon icon={DocumentTextIcon} size="sm" />}
      isLoading={isOpening}
      onClick={onPickDocument}
    />
  ) : (
    <Button label="Open…" variant={variant} isLoading={isOpening} onClick={onPickDocument} />
  );
}

type RecentSideNavItemProps = {
  path: string;
  menuLabel: string;
  displayPath: string;
  isSelected: boolean;
  isOpening: boolean;
  onOpen: () => void;
  onForget: () => void;
};

function RecentSideNavItem({
  path,
  menuLabel,
  displayPath,
  isSelected,
  isOpening,
  onOpen,
  onForget,
}: RecentSideNavItemProps) {
  const { isCollapsed } = useSideNavCollapse();
  const copy = useCopy();
  const anchorRef = useRef<HTMLDivElement>(null);
  const itemLabel = isCollapsed ? displayPath : menuLabel;
  const icon = fileIcon(path);

  return (
    <RecentItemRow ref={anchorRef}>
      <SideNavItem
        label={itemLabel}
        icon={icon}
        selectedIcon={icon}
        // Reading a file off disk is the one part of opening we can't make
        // instant, so the clicked row claims selection immediately rather than
        // leaving the click looking dropped until the document lands.
        isSelected={isSelected || isOpening}
        onClick={onOpen}
        // Collapsed, the rail is icon-width: there is nowhere to put the menu,
        // and the row's own tooltip is already doing the explaining.
        actions={
          isCollapsed ? undefined : (
            <RecentItemActions>
              <MoreMenu
                label={`Actions for ${menuLabel}`}
                size="sm"
                alignment="end"
                items={[
                  { label: "Copy path", onClick: () => void copy(path, "Path") },
                  { type: "divider" },
                  {
                    label: "Remove from recents",
                    variant: "destructive",
                    onClick: onForget,
                  },
                ]}
              />
            </RecentItemActions>
          )
        }
      />
      {/* Collapsed, the row is icon-width and its label is gone from the
          screen, so the tooltip is the only thing naming the file. */}
      {isCollapsed || displayPath !== menuLabel ? (
        <Tooltip content={displayPath} placement="end" alignment="start" anchorRef={anchorRef} />
      ) : null}
    </RecentItemRow>
  );
}

function RecentsSidebarFooter() {
  const { isCollapsed } = useSideNavCollapse();

  return (
    <HStack className="w-full" hAlign={isCollapsed ? "center" : "between"} vAlign="center">
      <SideNavCollapseButton />
      {isCollapsed ? null : <Badge label={`v${packageJson.version}`} />}
    </HStack>
  );
}

type RecentsSidebarProps = {
  paths: string[];
  selectedPath?: string;
  /** Recent currently being opened, if any — gets the pending affordance. */
  openingPath?: string | null;
  homeDirectory?: string;
  onOpen: (path: string) => void;
  onForget: (path: string) => void;
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
  openingPath = null,
  homeDirectory,
  onOpen,
  onForget,
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
        hasButton: false,
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
      footerIcons={<RecentsSidebarFooter />}
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
                path={path}
                menuLabel={menuLabel}
                displayPath={displayPaths.get(path) ?? menuLabel}
                isSelected={path === selectedPath}
                isOpening={path === openingPath}
                onOpen={() => onOpen(path)}
                onForget={() => onForget(path)}
              />
            );
          })
        )}
      </SideNavSection>
    </SideNav>
  );
}
