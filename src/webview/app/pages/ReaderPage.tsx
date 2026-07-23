import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useResizable } from "@astryxdesign/core/Resizable";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLogo } from "../components/AppLogo.tsx";
import { ColorSchemeToggle } from "../components/ColorSchemeToggle.tsx";
import { McpClientsIndicator } from "../components/McpClientsIndicator.tsx";
import { McpSettingsDialog } from "../components/McpSettingsDialog.tsx";
import { formatDisplayPath, pathFileName } from "../components/path-display.ts";
import { ReaderDropHint } from "../components/ReaderDropHint.tsx";
import { RecentsSidebar } from "../components/RecentsSidebar.tsx";
import { TabStrip } from "../components/TabStrip.tsx";
import { Cog6ToothIcon, ViewColumnsIcon } from "../icons.ts";
import { createTreatyReaderApi } from "../session/reader-api.ts";
import { useDocumentTabs } from "../session/useReaderSession.ts";
import { EmptyState } from "../ui/layout.tsx";
import { ReaderTab, type ReaderTabHandle } from "./ReaderTab.tsx";
import { UnsavedReaderTab } from "./UnsavedReaderTab.tsx";

const readerApi = createTreatyReaderApi();

const UNSAVED_TAB_ID = "__unsaved__";

type ReaderDocumentTopNavHeadingProps = {
  documentPath?: string;
  unsavedName?: string;
  homeDirectory?: string;
};

function ReaderDocumentTopNavHeading({
  documentPath,
  unsavedName,
  homeDirectory,
}: ReaderDocumentTopNavHeadingProps) {
  const anchorRef = useRef<HTMLDivElement>(null);

  if (unsavedName) {
    return (
      <TopNavHeading
        logo={<AppLogo />}
        superheading="mdreadr"
        heading={unsavedName}
        subheading="Unsaved"
      />
    );
  }

  if (!documentPath) {
    return <TopNavHeading logo={<AppLogo />} heading="mdreadr" />;
  }

  const displayPath = formatDisplayPath(documentPath, homeDirectory);

  return (
    <>
      <div ref={anchorRef}>
        <TopNavHeading
          logo={<AppLogo />}
          superheading="mdreadr"
          heading={pathFileName(documentPath)}
          subheading={displayPath}
        />
      </div>
      {displayPath !== documentPath ? (
        <Tooltip content={documentPath} placement="below" alignment="start" anchorRef={anchorRef} />
      ) : null}
    </>
  );
}

export function ReaderPage() {
  const notesSidebar = useResizable({
    defaultSize: 280,
    minSizePx: 220,
    maxSizePx: 480,
    collapsible: true,
    autoSaveId: "mdreadr-notes-sidebar",
  });

  const [isMcpSettingsOpen, setIsMcpSettingsOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  // Content read client-side from a drag-drop the webview can't resolve a path
  // for (Electrobun's WKWebView, unlike Electron, never exposes File.path).
  // Held locally, as its own client-only tab, until Save As succeeds.
  const [unsavedDrop, setUnsavedDrop] = useState<{
    name: string;
    content: string;
    key: number;
  } | null>(null);
  const [isUnsavedActive, setIsUnsavedActive] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [discardTargetLabel, setDiscardTargetLabel] = useState("");
  const pendingActionRef = useRef<(() => void) | null>(null);
  const tabRefs = useRef<Record<string, ReaderTabHandle | null>>({});
  const unsavedDropSeqRef = useRef(0);

  const tabs = useDocumentTabs(readerApi, {
    onNotesLoaded: () => setLiveMessage("Notes loaded"),
    onSaved: () => {
      setUnsavedDrop(null);
      setIsUnsavedActive(false);
    },
  });

  const effectiveActiveId = isUnsavedActive && unsavedDrop ? UNSAVED_TAB_ID : tabs.activeId;
  const activeDocumentPath = isUnsavedActive ? undefined : tabs.activeDocument?.path;

  const handleDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((prev) => {
      if (prev.has(id) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleOpenPath = useCallback(
    (path: string) => {
      setIsUnsavedActive(false);
      tabs.open(path);
    },
    [tabs],
  );

  const handleDropUnsaved = useCallback(
    (name: string, content: string) => {
      const replace = () => {
        unsavedDropSeqRef.current += 1;
        setUnsavedDrop({ name, content, key: unsavedDropSeqRef.current });
        setIsUnsavedActive(true);
      };

      if (unsavedDrop && dirtyIds.has(UNSAVED_TAB_ID)) {
        pendingActionRef.current = replace;
        setDiscardTargetLabel(unsavedDrop.name);
        setIsDiscardDialogOpen(true);
        return;
      }

      replace();
    },
    [unsavedDrop, dirtyIds],
  );

  const handleActivateTab = useCallback(
    (id: string) => {
      if (id === UNSAVED_TAB_ID) {
        setIsUnsavedActive(true);
        return;
      }
      setIsUnsavedActive(false);
      tabs.activateTab(id);
    },
    [tabs],
  );

  const handleRequestCloseTab = useCallback(
    (id: string) => {
      if (id === UNSAVED_TAB_ID) {
        const close = () => {
          setUnsavedDrop(null);
          setIsUnsavedActive(false);
          handleDirtyChange(UNSAVED_TAB_ID, false);
        };
        if (dirtyIds.has(UNSAVED_TAB_ID)) {
          pendingActionRef.current = close;
          setDiscardTargetLabel(unsavedDrop?.name ?? "This document");
          setIsDiscardDialogOpen(true);
          return;
        }
        close();
        return;
      }

      if (dirtyIds.has(id)) {
        pendingActionRef.current = () => {
          tabRefs.current[id]?.discardDraft();
          tabs.closeTab(id);
        };
        const path = tabs.tabs.find((tab) => tab.id === id)?.document.path;
        setDiscardTargetLabel(path ? pathFileName(path) : "This document");
        setIsDiscardDialogOpen(true);
        return;
      }

      tabs.closeTab(id);
    },
    [dirtyIds, tabs, unsavedDrop, handleDirtyChange],
  );

  const handleSaveAs = useCallback(
    (content: string) => {
      if (!unsavedDrop) return;
      tabs.saveDropped({ name: unsavedDrop.name, content });
    },
    [unsavedDrop, tabs],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "o") return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }

      event.preventDefault();
      tabs.pick();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tabs]);

  useEffect(() => {
    readerApi.log("ReaderPage mounted");

    const handleOpenDocument = () => {
      readerApi.log("mdreadr:open-document received, invalidating queries...");
      tabs.refresh();
    };

    window.addEventListener("mdreadr:open-document", handleOpenDocument);
    return () => window.removeEventListener("mdreadr:open-document", handleOpenDocument);
  }, [tabs]);

  const tabStripEntries = [
    ...tabs.tabs.map((tab) => ({ id: tab.id, label: pathFileName(tab.document.path) })),
    ...(unsavedDrop ? [{ id: UNSAVED_TAB_ID, label: unsavedDrop.name }] : []),
  ];

  return (
    <AppShell
      contentPadding={0}
      topNav={
        <TopNav
          label="Reader"
          heading={
            <ReaderDocumentTopNavHeading
              documentPath={activeDocumentPath}
              unsavedName={isUnsavedActive ? unsavedDrop?.name : undefined}
              homeDirectory={tabs.homeDirectory}
            />
          }
          endContent={
            <HStack gap={2} vAlign="center">
              <ColorSchemeToggle />
              <McpClientsIndicator />
              <IconButton
                label="MCP settings"
                tooltip="MCP settings"
                variant="ghost"
                icon={<Icon icon={Cog6ToothIcon} size="sm" />}
                onClick={() => setIsMcpSettingsOpen(true)}
              />
              <IconButton
                label={notesSidebar.isCollapsed ? "Show notes sidebar" : "Hide notes sidebar"}
                tooltip={notesSidebar.isCollapsed ? "Show notes sidebar" : "Hide notes sidebar"}
                variant={notesSidebar.isCollapsed ? "ghost" : "secondary"}
                icon={<Icon icon={ViewColumnsIcon} size="sm" />}
                onClick={() =>
                  notesSidebar.isCollapsed ? notesSidebar.expand() : notesSidebar.collapse()
                }
              />
              <Button
                label="Open…"
                variant="secondary"
                isLoading={tabs.isOpening}
                onClick={tabs.pick}
              />
            </HStack>
          }
        />
      }
      sideNav={
        <RecentsSidebar
          paths={tabs.recents}
          selectedPath={activeDocumentPath}
          homeDirectory={tabs.homeDirectory}
          onOpen={handleOpenPath}
          onPickDocument={tabs.pick}
          isOpening={tabs.isOpening}
        />
      }
    >
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {tabStripEntries.length === 0 ? (
        <EmptyState className="reader-empty-enter">
          <AppLogo size={48} />
          <ReaderDropHint />
          <Button
            label="Open markdown…"
            variant="primary"
            isLoading={tabs.isOpening}
            onClick={tabs.pick}
          />
        </EmptyState>
      ) : (
        <>
          <TabStrip
            tabs={tabStripEntries}
            activeId={effectiveActiveId}
            dirtyIds={dirtyIds}
            onActivate={handleActivateTab}
            onRequestClose={handleRequestCloseTab}
          />

          {tabs.tabs.map((tab) => (
            <div key={tab.id} hidden={effectiveActiveId !== tab.id}>
              <ReaderTab
                ref={(handle) => {
                  tabRefs.current[tab.id] = handle;
                }}
                readerApi={readerApi}
                tabId={tab.id}
                isActive={effectiveActiveId === tab.id}
                notesSidebar={notesSidebar}
                onOpenPath={handleOpenPath}
                onDropUnsaved={handleDropUnsaved}
                onDirtyChange={handleDirtyChange}
                onAnnounce={setLiveMessage}
                onLoadNotes={tabs.load}
                isLoadingNotes={tabs.isLoadingNotes}
              />
            </div>
          ))}

          {unsavedDrop ? (
            <div hidden={effectiveActiveId !== UNSAVED_TAB_ID}>
              <UnsavedReaderTab
                key={unsavedDrop.key}
                name={unsavedDrop.name}
                content={unsavedDrop.content}
                notesSidebar={notesSidebar}
                isSaving={tabs.isSavingDropped}
                onOpenPath={handleOpenPath}
                onDropUnsaved={handleDropUnsaved}
                onDirtyChange={handleDirtyChange}
                onSaveAs={handleSaveAs}
              />
            </div>
          ) : null}
        </>
      )}

      <AlertDialog
        isOpen={isDiscardDialogOpen}
        onOpenChange={(open) => {
          setIsDiscardDialogOpen(open);
          if (!open) {
            pendingActionRef.current = null;
          }
        }}
        title="Discard draft?"
        description={`${discardTargetLabel} has unsaved changes. Discarding cannot be undone.`}
        cancelLabel="Keep editing"
        actionLabel="Discard"
        onAction={() => {
          setIsDiscardDialogOpen(false);
          const pending = pendingActionRef.current;
          pendingActionRef.current = null;
          pending?.();
        }}
      />

      <McpSettingsDialog isOpen={isMcpSettingsOpen} onOpenChange={setIsMcpSettingsOpen} />
    </AppShell>
  );
}
