import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import type { ResizableRegion } from "@astryxdesign/core/Resizable";
import type { BlockAnchor, SubBlockTarget } from "@mdreadr/domain";
import { applyBlockEdit, applySubBlockEdit } from "@mdreadr/domain";
import { err, ok, type Result } from "@onrails/result";
import { useContainer, useStoreValues } from "@re-reduced/react";
import { useEffect, useRef, useState } from "react";
import { DocumentView } from "../components/DocumentView.tsx";
import { useFileDrop } from "../hooks/useFileDrop.ts";
import type { BlockEditError } from "../session/block-edit.ts";
import { ReaderTabShell } from "./ReaderTabShell.tsx";
import { readerPageContainer } from "./reader-page-container.ts";

type NotesSidebar = ResizableRegion;

type UnsavedReaderTabProps = {
  name: string;
  content: string;
  notesSidebar: NotesSidebar;
  isSaving: boolean;
  isActive: boolean;
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
  isActive,
  onOpenPath,
  onDropUnsaved,
  onDirtyChange,
  onSaveAs,
}: UnsavedReaderTabProps) {
  const store = useContainer(readerPageContainer);
  const { documentViewMode, isDragOver } = useStoreValues(store);
  const readerMainRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(initialContent);
  const dirty = text !== initialContent;

  const drop = useFileDrop({
    onOpenPath,
    onDropUnsaved,
    onDragOverChange: store.actions.dragOverChanged,
  });

  useEffect(() => {
    onDirtyChange(UNSAVED_TAB_ID, dirty);
  }, [dirty, onDirtyChange]);

  const onEditBlock = (
    anchor: BlockAnchor,
    newMarkdown: string,
    target?: SubBlockTarget,
  ): Result<void, BlockEditError> => {
    const updated = target
      ? applySubBlockEdit(text, anchor, target, newMarkdown)
      : applyBlockEdit(text, anchor, newMarkdown);
    if (updated === undefined) return err({ _tag: "BlockNotFound" });
    setText(updated);
    return ok(undefined);
  };

  return (
    <ReaderTabShell
      notesSidebar={notesSidebar}
      mainRef={readerMainRef}
      drop={drop}
      isDragOver={isDragOver}
      outline={
        <EmptyState
          isCompact
          className="reader-empty-enter h-full justify-center"
          title="No table of contents"
          description="Save this document to outline its headings."
        />
      }
      notes={
        <EmptyState
          isCompact
          className="reader-empty-enter h-full justify-center"
          title={`${name} is unsaved`}
          description="Save it to add notes and suggestions."
        />
      }
    >
      <DocumentView
        content={text}
        notes={[]}
        isActive={isActive}
        viewMode={documentViewMode}
        onViewModeChange={store.actions.documentViewModeChanged}
        onEditBlock={onEditBlock}
        onOpenDocument={onOpenPath}
        editorValue={text}
        onEditorChange={setText}
        chromeEnd={
          documentViewMode === "edit" || dirty ? (
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
    </ReaderTabShell>
  );
}

export { UNSAVED_TAB_ID };
