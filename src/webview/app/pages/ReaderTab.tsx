import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { type ResizableRegion, ResizeHandle } from "@astryxdesign/core/Resizable";
import { Stack } from "@astryxdesign/core/Stack";
import type { Suggestion } from "@mdreadr/domain";
import { applySuggestion, extractHeadings } from "@mdreadr/domain";
import { useContainer, useStoreValues } from "@re-reduced/react";
import type { CSSProperties } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { DocumentView } from "../components/DocumentView.tsx";
import { NotesPanel } from "../components/NotesPanel.tsx";
import { SuggestionsPanel } from "../components/SuggestionsPanel.tsx";
import { TocSidebar } from "../components/TocSidebar.tsx";
import { useMutationToast } from "../hooks/useMutationToast.ts";
import { ArrowDownTrayIcon } from "../icons.ts";
import { flashAnchor, scrollToAnchor } from "../markdown/anchors.ts";
import { isDirty } from "../session/document-draft.ts";
import type { ReaderApi } from "../session/reader-api.ts";
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

type NotesSidebar = ResizableRegion;

export type ReaderTabHandle = { discardDraft: () => void };

type ReaderTabProps = {
  readerApi: ReaderApi;
  tabId: string;
  isActive: boolean;
  notesSidebar: NotesSidebar;
  onOpenPath: (path: string) => void;
  onDropUnsaved: (name: string, content: string) => void;
  onDirtyChange: (tabId: string, dirty: boolean) => void;
  onAnnounce: (message: string) => void;
  onLoadNotes: () => Promise<void>;
  isLoadingNotes: boolean;
};

export const ReaderTab = forwardRef<ReaderTabHandle, ReaderTabProps>(function ReaderTab(
  {
    readerApi,
    tabId,
    isActive,
    notesSidebar,
    onOpenPath,
    onDropUnsaved,
    onDirtyChange,
    onAnnounce,
    onLoadNotes,
    isLoadingNotes,
  },
  ref,
) {
  const { showError } = useMutationToast();
  const store = useContainer(readerPageContainer);
  const { pendingAnchor, documentViewMode, isDragOver, draft } = useStoreValues(store);
  const readerMainRef = useRef<HTMLElement>(null);
  const dragDepthRef = useRef(0);

  const reader = useReaderSession(readerApi, tabId, isActive, {
    onNoteCreated: () => {
      store.actions.pendingAnchorChanged(null);
      onAnnounce("Note added");
    },
    onReplyAdded: () => {
      onAnnounce("Reply added");
    },
    onStatusChanged: (status) => {
      onAnnounce(`Note marked ${status ?? "updated"}`);
    },
    onNotesSaved: () => {
      onAnnounce("Notes saved");
    },
    onDocumentSaved: () => {
      store.actions.draftMarkedSaved();
      onAnnounce("Document saved");
    },
  });

  useImperativeHandle(ref, () => ({ discardDraft: () => store.actions.draftDiscarded() }), [store]);

  const content = reader.session.data?.documentContent ?? "";
  const documentPath = reader.session.data?.document?.path;
  const dirty = isDirty(draft, documentPath);
  const editorValue = (draft.path === documentPath ? draft.text : null) ?? content;

  useEffect(() => {
    onDirtyChange(tabId, dirty);
  }, [tabId, dirty, onDirtyChange]);

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

      const isMarkdown = /\.(md|markdown)$/i.test(file.name);
      const path = (file as File & { path?: string }).path;

      // Some environments (Electron) expose the real filesystem path on drop.
      // Electrobun's WKWebView never does — fall through to reading the
      // File's content directly below.
      if (path) {
        if (isMarkdown) onOpenPath(path);
        return;
      }

      if (!isMarkdown) {
        showError("Open dropped file", `"${file.name}" is not a markdown file.`);
        return;
      }

      void file
        .text()
        .then((text) => onDropUnsaved(file.name, text))
        .catch(() => showError("Open dropped file", "Could not read the dropped file."));
    },
    [onOpenPath, onDropUnsaved, showError, store],
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
      if (!isActive) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "s") return;
      if (documentViewMode !== "edit") return;
      event.preventDefault();
      if (dirty) {
        void saveDraft();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isActive, dirty, documentViewMode, saveDraft]);

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
        <ReaderContent>
          <DocumentView
            key={tabId}
            content={content}
            documentPath={documentPath}
            notes={notes}
            viewMode={documentViewMode}
            onViewModeChange={store.actions.documentViewModeChanged}
            onPinBlock={(anchor) => {
              store.actions.pendingAnchorChanged(anchor);
              flashAnchor(anchor.blockId, "reader-block-pin-flash");
              onAnnounce(`Pinning note to ${anchor.label ?? anchor.kind}`);
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
          isLoadingNotes={isLoadingNotes}
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
          onLoadNotes={onLoadNotes}
          onScrollToAnchor={onScrollToAnchor}
        />
      </ReaderNotesAside>
    </ReaderLayout>
  );
});
