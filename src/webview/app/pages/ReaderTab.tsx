import { Button } from "@astryxdesign/core/Button";
import type { ResizableRegion } from "@astryxdesign/core/Resizable";
import type { EditorView } from "@codemirror/view";
import type { BlockAnchor, SubBlockTarget, Suggestion, TocEntry } from "@mdreadr/domain";
import {
  applyBlockEdit,
  applySubBlockEdit,
  applySuggestion,
  documentKindForPath,
  extractHeadings,
} from "@mdreadr/domain";
import { err, ok, type Result } from "@onrails/result";
import { useContainer, useSelect, useStoreValues } from "@re-reduced/react";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { DocumentView } from "../components/DocumentView.tsx";
import { ReviewPanel } from "../components/ReviewPanel.tsx";
import { TocSidebar } from "../components/TocSidebar.tsx";
import { registerEditorView } from "../editorCommands.ts";
import { useEditorOutlineSpy } from "../hooks/useEditorOutlineSpy.ts";
import { useFileDrop } from "../hooks/useFileDrop.ts";
import { useLiveDocumentUpdates } from "../hooks/useLiveDocumentUpdates.ts";
import { useMutationToast } from "../hooks/useMutationToast.ts";
import { useViewModeHandoff } from "../hooks/useViewModeHandoff.ts";
import { flashAnchor, scrollToAnchor } from "../markdown/anchors.ts";
import { beginReaderTiming, completeReaderTiming } from "../performance.ts";
import type { BlockEditError } from "../session/block-edit.ts";
import { emptyDraft, isDirty } from "../session/document-draft.ts";
import { scrollEditorToSettled } from "../session/editor-scroll.ts";
import type { ReaderApi } from "../session/reader-api.ts";
import { useReaderSession } from "../session/useReaderSession.ts";
import { ReaderTabShell } from "./ReaderTabShell.tsx";
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

const ReaderTabInner = forwardRef<ReaderTabHandle, ReaderTabProps>(function ReaderTab(
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
  const { pendingAnchor, documentViewMode, isDragOver } = useStoreValues(store);
  const readerMainRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  const drop = useFileDrop({
    onOpenPath,
    onDropUnsaved,
    onDragOverChange: store.actions.dragOverChanged,
  });

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
  // A single Draft belongs to one Document. Selecting the draft for this tab
  // prevents an edit in the active Document from waking every parked tab.
  const draft = useSelect(store, (state) =>
    state.draft.value.path === documentPath ? state.draft.value : emptyDraft,
  );
  const kind = documentPath ? documentKindForPath(documentPath) : "markdown";
  const dirty = isDirty(draft, documentPath);
  const editorValue = (draft.path === documentPath ? draft.text : null) ?? content;

  useEffect(() => {
    onDirtyChange(tabId, dirty);
  }, [tabId, dirty, onDirtyChange]);

  useEffect(() => {
    if (!isActive || !documentPath) return;
    const frame = requestAnimationFrame(() => {
      completeReaderTiming(`tab:${tabId}`, {
        documentBytes: content.length,
        documentPath,
      });
      completeReaderTiming(`inline-edit:${tabId}`, {
        documentBytes: editorValue.length,
        documentPath,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [isActive, tabId, documentPath, content.length, editorValue]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isActive) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "s") return;
      if (documentViewMode !== "edit" && !dirty) return;
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

  // Keeps the reading position and flashes the blocks an agent (or any other
  // writer) just changed on disk; the reload itself comes from the file watcher
  // in `documentSession`.
  useLiveDocumentUpdates(content, readerMainRef, isActive && documentViewMode === "preview");

  const notes = reader.notes.data ?? [];
  const suggestions = reader.suggestions.data ?? [];
  // The outline stays live in edit mode by reading the draft instead of the
  // saved content, so the column never degrades into an apology.
  // A non-markdown Document has no preview to switch back to, so it is always
  // the editor — and an image is neither.
  const isEditing = kind === "source" || (kind === "markdown" && documentViewMode === "edit");

  // Keeps the reading position across a Preview <-> Edit toggle.
  const changeViewMode = useViewModeHandoff({
    viewMode: documentViewMode,
    content: editorValue,
    rootRef: readerMainRef,
    editorViewRef,
    onChange: store.actions.documentViewModeChanged,
  });
  // Only markdown has headings: `# ` in a shell script or a Python file is a
  // comment, and an outline built from those is noise.
  const toc = useMemo(
    () => (kind === "markdown" ? extractHeadings(isEditing ? editorValue : content) : []),
    [kind, isEditing, editorValue, content],
  );

  // The DOM scroll spy inside TocSidebar has no heading elements to watch in
  // edit mode, so the active section is tracked against the editor instead.
  const editorActiveHeadingId = useEditorOutlineSpy(editorViewRef, readerMainRef, toc, isEditing);

  const onSelectHeadingInEditor = useCallback((entry: TocEntry) => {
    const view = editorViewRef.current;
    const root = readerMainRef.current;
    if (!view || !root) return;
    const lineNumber = Math.min(entry.line + 1, view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    view.dispatch({ selection: { anchor: line.from } });
    scrollEditorToSettled(view, root, line.from);
    view.focus();
  }, []);

  const onScrollToAnchor = useCallback(
    (blockId: string) => {
      const jump = () => {
        if (!scrollToAnchor(blockId)) {
          showError("Jump to note", "Could not find that block in the document.");
        }
      };

      if (documentViewMode !== "preview") {
        // Raw action, not the handoff: this jump supplies its own destination.
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

  // An `Err` leaves the inline editor open with the reader's text in it, which
  // is the only copy of it at that point.
  const onEditBlock = useCallback(
    (
      anchor: BlockAnchor,
      newMarkdown: string,
      // Set when only one part of the block was edited (a list item, a table
      // row): the splice is that part's range, so the rest of the list or table
      // survives byte for byte.
      target?: SubBlockTarget,
    ): Result<void, BlockEditError> => {
      if (!documentPath) return err({ _tag: "NoDocument" });
      const updated = target
        ? applySubBlockEdit(editorValue, anchor, target, newMarkdown)
        : applyBlockEdit(editorValue, anchor, newMarkdown);
      if (updated === undefined) {
        showError("Edit block", "Could not locate that block in the document.");
        return err({ _tag: "BlockNotFound" });
      }
      beginReaderTiming(`inline-edit:${tabId}`, "inline edit apply", {
        tabId,
        anchorKind: anchor.kind,
      });
      store.actions.draftEdited({ path: documentPath, text: updated, savedContent: content });
      // The flash is MarkdownView's: the edited block comes back with a new
      // content-derived id, so only it can still find the block by position.
      onAnnounce(`Updated ${anchor.label ?? anchor.kind} in draft`);
      return ok(undefined);
    },
    [documentPath, editorValue, content, showError, store, onAnnounce, tabId],
  );

  const onPinBlock = useCallback(
    (anchor: BlockAnchor) => {
      store.actions.pendingAnchorChanged(anchor);
      flashAnchor(anchor.blockId, "reader-block-pin-flash");
      onAnnounce(`Anchoring a note to ${anchor.label ?? anchor.kind}`);
    },
    [store, onAnnounce],
  );

  const onEditorReady = useCallback((view: EditorView) => {
    editorViewRef.current = view;
    registerEditorView(view);
  }, []);

  return (
    <ReaderTabShell
      notesSidebar={notesSidebar}
      mainRef={readerMainRef}
      drop={drop}
      isDragOver={isDragOver}
      isNotesPending={Boolean(pendingAnchor)}
      outline={
        <TocSidebar
          entries={toc}
          scrollRootRef={readerMainRef}
          documentKey={documentPath}
          onSelect={isEditing ? onSelectHeadingInEditor : undefined}
          activeId={editorActiveHeadingId}
        />
      }
      notes={
        <ReviewPanel
          notes={notes}
          suggestions={suggestions}
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
          onAcceptSuggestion={onAcceptSuggestion}
          onRejectSuggestion={onRejectSuggestion}
          onSaveNotes={async () => {
            await reader.save();
          }}
          onLoadNotes={onLoadNotes}
          onScrollToAnchor={onScrollToAnchor}
        />
      }
    >
      <DocumentView
        key={tabId}
        content={editorValue}
        documentPath={documentPath}
        kind={kind}
        notes={notes}
        isActive={isActive}
        viewMode={documentViewMode}
        onViewModeChange={changeViewMode}
        onPinBlock={onPinBlock}
        onEditBlock={onEditBlock}
        onOpenDocument={onOpenPath}
        editorValue={editorValue}
        onEditorChange={onEditorChange}
        onEditorReady={onEditorReady}
        chromeEnd={
          isEditing || dirty ? (
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
    </ReaderTabShell>
  );
});

/** Parked tabs retain their editor/scroll state, but need not reconcile their
 * complete markdown trees whenever ReaderPage's shell state changes. */
export const ReaderTab = memo(ReaderTabInner);
