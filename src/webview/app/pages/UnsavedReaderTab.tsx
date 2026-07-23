import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { type ResizableRegion, ResizeHandle } from "@astryxdesign/core/Resizable";
import { Stack } from "@astryxdesign/core/Stack";
import { useContainer, useStoreValues } from "@re-reduced/react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentView } from "../components/DocumentView.tsx";
import { useMutationToast } from "../hooks/useMutationToast.ts";
import { ArrowDownTrayIcon } from "../icons.ts";
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

type UnsavedReaderTabProps = {
  name: string;
  content: string;
  notesSidebar: NotesSidebar;
  isSaving: boolean;
  onOpenPath: (path: string) => void;
  onDropUnsaved: (name: string, content: string) => void;
  onDirtyChange: (tabId: string, dirty: boolean) => void;
  onSaveAs: (content: string) => void;
};

const UNSAVED_TAB_ID = "__unsaved__";

export function UnsavedReaderTab({
  name,
  content: initialContent,
  notesSidebar,
  isSaving,
  onOpenPath,
  onDropUnsaved,
  onDirtyChange,
  onSaveAs,
}: UnsavedReaderTabProps) {
  const { showError } = useMutationToast();
  const store = useContainer(readerPageContainer);
  const { documentViewMode, isDragOver } = useStoreValues(store);
  const readerMainRef = useRef<HTMLElement>(null);
  const dragDepthRef = useRef(0);
  const [text, setText] = useState(initialContent);
  const dirty = text !== initialContent;

  useEffect(() => {
    onDirtyChange(UNSAVED_TAB_ID, dirty);
  }, [dirty, onDirtyChange]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      store.actions.dragOverChanged(false);

      const file = event.dataTransfer.files.item(0);
      if (!file) return;

      const isMarkdown = /\.(md|markdown)$/i.test(file.name);
      const path = (file as File & { path?: string }).path;

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
        .then((droppedText) => onDropUnsaved(file.name, droppedText))
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

  return (
    <ReaderLayout
      aria-label="Document reader"
      style={{ "--notes-col-width": `${notesSidebar.size}px` } as CSSProperties}
    >
      <ReaderPanel>
        <EmptyState className="reader-empty-enter">
          <p>Table of contents is available once this document is saved.</p>
        </EmptyState>
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
            content={text}
            notes={[]}
            viewMode={documentViewMode}
            onViewModeChange={store.actions.documentViewModeChanged}
            editorValue={text}
            onEditorChange={setText}
            chromeEnd={
              documentViewMode === "edit" ? (
                <Button
                  label="Save As…"
                  variant="primary"
                  size="sm"
                  isLoading={isSaving}
                  onClick={() => onSaveAs(text)}
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

      <ReaderNotesAside>
        <EmptyState className="reader-empty-enter">
          <p>{name} is unsaved. Save it to add notes and suggestions.</p>
        </EmptyState>
      </ReaderNotesAside>
    </ReaderLayout>
  );
}

export { UNSAVED_TAB_ID };
