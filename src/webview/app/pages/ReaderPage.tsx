import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { ResizeHandle, useResizable } from "@astryxdesign/core/Resizable";
import { Stack } from "@astryxdesign/core/Stack";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import type { Suggestion } from "@mdreadr/domain";
import { applySuggestion, extractHeadings } from "@mdreadr/domain";
import { useContainer, useStoreValues } from "@re-reduced/react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLogo } from "../components/AppLogo.tsx";
import { ColorSchemeToggle } from "../components/ColorSchemeToggle.tsx";
import { DocumentView } from "../components/DocumentView.tsx";
import { McpClientsIndicator } from "../components/McpClientsIndicator.tsx";
import { McpSettingsDialog } from "../components/McpSettingsDialog.tsx";
import { NotesPanel } from "../components/NotesPanel.tsx";
import { formatDisplayPath, pathFileName } from "../components/path-display.ts";
import { ReaderDropHint } from "../components/ReaderDropHint.tsx";
import { RecentsSidebar } from "../components/RecentsSidebar.tsx";
import { SuggestionsPanel } from "../components/SuggestionsPanel.tsx";
import { TocSidebar } from "../components/TocSidebar.tsx";
import { useMutationToast } from "../hooks/useMutationToast.ts";
import { ArrowDownTrayIcon, Cog6ToothIcon, ViewColumnsIcon } from "../icons.ts";
import { flashAnchor, scrollToAnchor } from "../markdown/anchors.ts";
import { isDirty } from "../session/document-draft.ts";
import { createTreatyReaderApi } from "../session/reader-api.ts";
import { useReaderSession } from "../session/useReaderSession.ts";
import {
  EmptyState,
  ReaderContent,
  ReaderLayout,
  ReaderMain,
  ReaderNotesAside,
  ReaderPanel,
} from "../ui/layout.tsx";
import { readerPageContainer } from "./reader-page-container.ts";

const readerApi = createTreatyReaderApi();

type ReaderDocumentTopNavHeadingProps = {
  documentPath?: string;
  homeDirectory?: string;
};

function ReaderDocumentTopNavHeading({
  documentPath,
  homeDirectory,
}: ReaderDocumentTopNavHeadingProps) {
  const anchorRef = useRef<HTMLDivElement>(null);

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
  const { showError } = useMutationToast();
  const notesSidebar = useResizable({
    defaultSize: 280,
    minSizePx: 220,
    maxSizePx: 480,
    collapsible: true,
    autoSaveId: "mdreadr-notes-sidebar",
  });
  const store = useContainer(readerPageContainer);
  const { pendingAnchor, documentViewMode, liveMessage, isDragOver, draft, isDiscardDialogOpen } =
    useStoreValues(store);
  const readerMainRef = useRef<HTMLElement>(null);
  const dragDepthRef = useRef(0);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [isMcpSettingsOpen, setIsMcpSettingsOpen] = useState(false);

  const reader = useReaderSession(readerApi, {
    onOpened: (path) => {
      store.actions.pendingAnchorChanged(null);
      store.actions.liveMessageChanged(`Opened ${pathFileName(path)}`);
    },
    onNoteCreated: () => {
      store.actions.pendingAnchorChanged(null);
      store.actions.liveMessageChanged("Note added");
    },
    onReplyAdded: () => {
      store.actions.liveMessageChanged("Reply added");
    },
    onStatusChanged: (status) => {
      store.actions.liveMessageChanged(`Note marked ${status ?? "updated"}`);
    },
    onNotesSaved: () => {
      store.actions.liveMessageChanged("Notes saved");
    },
    onNotesLoaded: () => {
      store.actions.liveMessageChanged("Notes loaded");
    },
    onDocumentSaved: () => {
      store.actions.draftMarkedSaved();
      store.actions.liveMessageChanged("Document saved");
    },
  });

  const content = reader.session.data?.documentContent ?? "";
  const documentPath = reader.session.data?.document?.path;
  const dirty = isDirty(draft, documentPath);
  const editorValue = (draft.path === documentPath ? draft.text : null) ?? content;

  const runGuarded = useCallback(
    (action: () => void) => {
      if (dirty) {
        pendingActionRef.current = action;
        store.actions.discardDialogOpenChanged(true);
        return;
      }
      action();
    },
    [dirty, store],
  );

  const requestOpen = useCallback(
    (path: string) => runGuarded(() => reader.open(path)),
    [reader, runGuarded],
  );

  const requestPick = useCallback(() => runGuarded(() => reader.pick()), [reader, runGuarded]);

  const onEditorChange = useCallback(
    (text: string) => {
      if (!documentPath) return;
      store.actions.draftEdited({ path: documentPath, text, savedContent: content });
    },
    [documentPath, content, store],
  );

  const saveDraft = useCallback(async () => {
    if (!documentPath || draft.path !== documentPath || draft.text === null) return;
    await reader.saveDocument(documentPath, draft.text);
  }, [documentPath, draft, reader]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      store.actions.dragOverChanged(false);

      const file = event.dataTransfer.files.item(0);
      if (!file) return;

      const path = (file as File & { path?: string }).path;
      if (path?.endsWith(".md")) {
        requestOpen(path);
        return;
      }

      if (!path) {
        showError(
          "Open dropped file",
          "This environment cannot read the file path from drag-and-drop. Use Open… instead.",
        );
      }
    },
    [requestOpen, showError, store],
  );

  const onDragEnter = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!event.dataTransfer.types.includes("Files")) return;
      dragDepthRef.current += 1;
      store.actions.dragOverChanged(true);
    },
    [store],
  );

  const onDragLeave = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!event.dataTransfer.types.includes("Files")) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        store.actions.dragOverChanged(false);
      }
    },
    [store],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();

      if (key === "s") {
        if (documentViewMode !== "edit") return;
        event.preventDefault();
        if (dirty) {
          void saveDraft();
        }
        return;
      }

      if (key === "o") {
        // Cmd+S must work while the editor textarea has focus, so this
        // input/textarea focus guard applies only to Cmd+O.
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest("input, textarea, select, [contenteditable='true']"))
        ) {
          return;
        }

        event.preventDefault();
        requestPick();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dirty, documentViewMode, requestPick, saveDraft]);

  useEffect(() => {
    readerApi.log("ReaderPage mounted");

    const handleOpenDocument = () => {
      readerApi.log("mdreadr:open-document received, invalidating queries...");
      reader.refresh();
    };

    window.addEventListener("mdreadr:open-document", handleOpenDocument);
    return () => window.removeEventListener("mdreadr:open-document", handleOpenDocument);
  }, [reader]);

  const prevContentRef = useRef(content);
  useEffect(() => {
    if (prevContentRef.current !== content) {
      if (dirty) {
        showError(
          "Document changed on disk",
          "Your draft is kept. Save to overwrite, or discard to reload.",
        );
      }
      prevContentRef.current = content;
    }
  }, [content, dirty, showError]);

  const notes = reader.notes.data ?? [];
  const suggestions = reader.suggestions.data ?? [];
  const toc = useMemo(() => extractHeadings(content), [content]);
  const isOpening = reader.isOpening;

  const onScrollToAnchor = useCallback(
    (blockId: string) => {
      const jump = () => {
        if (!scrollToAnchor(blockId)) {
          showError("Jump to note", "Could not find that block in the document.");
        }
      };

      if (documentViewMode !== "preview") {
        store.actions.documentViewModeChanged("preview");
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(jump);
        });
        return;
      }

      jump();
    },
    [documentViewMode, showError, store],
  );

  const onAcceptSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      if (!documentPath) return;
      const spliced = applySuggestion(editorValue, suggestion.anchor, suggestion.replacementText);
      if (spliced === undefined) {
        showError("Accept suggestion", "Could not locate that text in the document anymore.");
        return;
      }
      store.actions.draftEdited({ path: documentPath, text: spliced, savedContent: content });
      await reader.setSuggestionStatus(suggestion.id, "accepted");
    },
    [documentPath, editorValue, content, reader, showError, store],
  );

  const onRejectSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      await reader.setSuggestionStatus(suggestion.id, "rejected");
    },
    [reader],
  );

  return (
    <AppShell
      contentPadding={0}
      topNav={
        <TopNav
          label="Reader"
          heading={
            <ReaderDocumentTopNavHeading
              documentPath={documentPath}
              homeDirectory={reader.session.data?.homeDirectory}
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
                isLoading={isOpening}
                onClick={requestPick}
              />
            </HStack>
          }
        />
      }
      sideNav={
        <RecentsSidebar
          paths={reader.recents.data ?? []}
          selectedPath={documentPath}
          homeDirectory={reader.session.data?.homeDirectory}
          onOpen={requestOpen}
          onPickDocument={requestPick}
          isOpening={isOpening}
        />
      }
    >
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      <ReaderLayout
        aria-label="Document reader"
        style={{ "--notes-col-width": `${notesSidebar.size}px` } as CSSProperties}
      >
        <ReaderPanel>
          {documentViewMode === "preview" ? (
            <TocSidebar entries={toc} scrollRootRef={readerMainRef} documentKey={documentPath} />
          ) : (
            <EmptyState className="reader-empty-enter">
              <p>Table of contents is available in preview.</p>
            </EmptyState>
          )}
        </ReaderPanel>

        <ReaderMain
          ref={readerMainRef}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <div
            aria-hidden
            className="reader-main-drop-overlay"
            data-active={isDragOver ? "true" : "false"}
          >
            <Stack gap={2} vAlign="center" hAlign="center" className="reader-drop-overlay-content">
              <Icon icon={ArrowDownTrayIcon} size="lg" />
              Drop to open
            </Stack>
          </div>
          {content ? (
            <ReaderContent>
              <DocumentView
                key={documentPath}
                content={content}
                documentPath={documentPath}
                notes={notes}
                viewMode={documentViewMode}
                onViewModeChange={store.actions.documentViewModeChanged}
                onPinBlock={(anchor) => {
                  store.actions.pendingAnchorChanged(anchor);
                  flashAnchor(anchor.blockId, "reader-block-pin-flash");
                  store.actions.liveMessageChanged(
                    `Pinning note to ${anchor.label ?? anchor.kind}`,
                  );
                }}
                editorValue={editorValue}
                onEditorChange={onEditorChange}
                chromeEnd={
                  documentViewMode === "edit" ? (
                    <Button
                      label="Save"
                      variant="primary"
                      size="sm"
                      isDisabled={!dirty}
                      isLoading={reader.isSavingDocument}
                      onClick={() => {
                        void saveDraft();
                      }}
                    />
                  ) : undefined
                }
              />
            </ReaderContent>
          ) : (
            <EmptyState className="reader-empty-enter">
              <AppLogo size={48} />
              <ReaderDropHint />
              <Button
                label="Open markdown…"
                variant="primary"
                isLoading={isOpening}
                onClick={requestPick}
              />
            </EmptyState>
          )}
        </ReaderMain>

        <ResizeHandle
          resizable={notesSidebar.props}
          isReversed
          hasDivider
          label="Resize notes sidebar"
        />

        <ReaderNotesAside data-pending={pendingAnchor ? "true" : "false"}>
          <SuggestionsPanel
            suggestions={suggestions}
            onAccept={onAcceptSuggestion}
            onReject={onRejectSuggestion}
            onScrollToAnchor={onScrollToAnchor}
          />
          <NotesPanel
            notes={notes}
            pendingAnchor={pendingAnchor}
            isSaving={reader.isSaving}
            isLoadingNotes={reader.isLoadingNotes}
            isCreatingNote={reader.isCreatingNote}
            onCreateNote={async (input) => {
              await reader.createNote(input);
            }}
            onAddReply={async (noteId, body) => {
              await reader.addReply(noteId, body);
            }}
            onUpdateStatus={async (noteId, status) => {
              await reader.setStatus(noteId, status);
            }}
            onSaveNotes={async () => {
              await reader.save();
            }}
            onLoadNotes={async () => {
              await reader.load();
            }}
            onScrollToAnchor={onScrollToAnchor}
          />
        </ReaderNotesAside>
      </ReaderLayout>

      <AlertDialog
        isOpen={isDiscardDialogOpen}
        onOpenChange={(open) => {
          store.actions.discardDialogOpenChanged(open);
          if (!open) {
            pendingActionRef.current = null;
          }
        }}
        title="Discard draft?"
        description={`${draft.path ? pathFileName(draft.path) : "This Document"} has unsaved changes. Discarding cannot be undone.`}
        cancelLabel="Keep editing"
        actionLabel="Discard"
        onAction={() => {
          store.actions.draftDiscarded();
          store.actions.discardDialogOpenChanged(false);
          const pending = pendingActionRef.current;
          pendingActionRef.current = null;
          pending?.();
        }}
      />

      <McpSettingsDialog isOpen={isMcpSettingsOpen} onOpenChange={setIsMcpSettingsOpen} />
    </AppShell>
  );
}
