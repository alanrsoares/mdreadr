import { Markdown } from "@astryxdesign/core/Markdown";
import type { BlockAnchor, Note } from "@mdreadr/domain";
import { err, isErr, type Result } from "@onrails/result";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  callAttentionToInlineEditor,
  createAnchorPlan,
  focusBlockAtIndex,
  indexOfBlock,
  partitionReaderSegments,
} from "../markdown/anchors.ts";
import {
  BlockSourceEditor,
  blockClasses,
  createPinComponents,
} from "../markdown/pin-components.tsx";
import {
  createAssetResolver,
  createReaderInlinePlugins,
  preprocessReaderMarkdown,
} from "../markdown/pipeline.tsx";
import type { BlockEditError } from "../session/block-edit.ts";
import { useFontSettings } from "../theme/FontSettingsContext.tsx";
import { getReaderMeasurePx } from "../theme/measure.ts";
import { getApiBase } from "../treaty.ts";
import { EditableBlock } from "../ui/editable-block.tsx";
import { ReaderArticle, ReaderBlockWrap, ReaderFlow } from "../ui/reader.tsx";

type MarkdownViewProps = {
  content: string;
  notes: Note[];
  documentPath?: string;
  onPinBlock?: (anchor: BlockAnchor) => void;
  /** An `Err` leaves the inline editor open with the reader's text in it,
   *  rather than dropping the only copy of it. */
  onEditBlock?: (anchor: BlockAnchor, newMarkdown: string) => Result<void, BlockEditError>;
};

export function MarkdownView({
  content,
  notes,
  documentPath,
  onPinBlock,
  onEditBlock,
}: MarkdownViewProps) {
  const { readerFontSize, readerFontFamily } = useFontSettings();
  const measurePx = getReaderMeasurePx(readerFontSize, readerFontFamily);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const isEditorDirtyRef = useRef(false);
  // Where the block being edited sits in document order, captured before the
  // editor takes its place: an applied edit changes the block's own id.
  const editingIndexRef = useRef(-1);

  const prepared = useMemo(() => preprocessReaderMarkdown(content), [content]);
  const plan = useMemo(() => createAnchorPlan(prepared), [prepared]);
  const segments = useMemo(() => partitionReaderSegments(prepared), [prepared]);
  const notedBlockIds = useMemo(() => new Set(notes.map((note) => note.anchor.blockId)), [notes]);
  const resolveImageSrc = useMemo(
    () => createAssetResolver(getApiBase(), documentPath),
    [documentPath],
  );
  const inlinePlugins = useMemo(
    () => createReaderInlinePlugins(resolveImageSrc),
    [resolveImageSrc],
  );

  const handleEditorDirtyChange = useCallback((isDirty: boolean) => {
    isEditorDirtyRef.current = isDirty;
  }, []);

  /** Hands focus from the closing editor back to the block it replaced. Two
   *  frames: the first is React's commit, the second is when the restored block
   *  is really in the DOM to receive focus. */
  const returnFocusToBlock = useCallback((flashClassName?: string) => {
    const index = editingIndexRef.current;
    if (index < 0) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        focusBlockAtIndex(index, flashClassName);
        editingIndexRef.current = -1;
      });
    });
  }, []);

  const handleStartEditBlock = useCallback(
    (anchor: BlockAnchor) => {
      // Only one block is editable at a time, so opening a second editor would
      // silently discard the first one's text. The open editor gets the nudge.
      if (editingBlockId && editingBlockId !== anchor.blockId && isEditorDirtyRef.current) {
        callAttentionToInlineEditor();
        return;
      }
      editingIndexRef.current = indexOfBlock(anchor.blockId);
      setEditingBlockId(anchor.blockId);
    },
    [editingBlockId],
  );

  const handleCancelBlockEdit = useCallback(() => {
    setEditingBlockId(null);
    returnFocusToBlock();
  }, [returnFocusToBlock]);

  const handleSaveBlockEdit = useCallback(
    (anchor: BlockAnchor, newMarkdown: string): Result<void, BlockEditError> => {
      const applied = onEditBlock?.(anchor, newMarkdown) ?? err({ _tag: "BlockNotFound" });
      if (isErr(applied)) return applied;
      setEditingBlockId(null);
      returnFocusToBlock("reader-block-edit-flash");
      return applied;
    },
    [onEditBlock, returnFocusToBlock],
  );

  const pinContext = useMemo(
    () => ({
      onPinBlock,
      onStartEditBlock: onEditBlock ? handleStartEditBlock : undefined,
      editingBlockId,
      onSaveBlockEdit: handleSaveBlockEdit,
      onCancelBlockEdit: handleCancelBlockEdit,
      onEditorDirtyChange: handleEditorDirtyChange,
      content,
      plan,
      notedBlockIds,
      resolveImageSrc,
    }),
    [
      onPinBlock,
      onEditBlock,
      handleStartEditBlock,
      editingBlockId,
      handleSaveBlockEdit,
      handleCancelBlockEdit,
      handleEditorDirtyChange,
      content,
      plan,
      notedBlockIds,
      resolveImageSrc,
    ],
  );

  const components = useMemo(() => createPinComponents(pinContext), [pinContext]);

  // MUST run at the start of every render pass so cursors restart in sync
  // with the actual Markdown render, regardless of whether `components`
  // was recreated (fixes re-render cursor exhaustion).
  plan.begin();

  return (
    <ReaderArticle>
      <ReaderFlow>
        {segments.map((segment) => {
          if (segment.kind === "markdown") {
            return (
              <Markdown
                key={segment.key}
                className="reader-flow"
                contentWidth={measurePx}
                autolink="gfm"
                components={components}
                inlinePlugins={inlinePlugins}
              >
                {segment.text}
              </Markdown>
            );
          }

          const isList = segment.kind === "list";
          const anchor = isList ? plan.nextList(segment.rawText) : plan.nextTable(segment.rawText);

          if (editingBlockId === anchor.blockId) {
            return (
              <BlockSourceEditor
                key={segment.key}
                anchor={anchor}
                fallback={segment.text}
                ctx={pinContext}
              />
            );
          }

          return (
            <EditableBlock
              key={segment.key}
              anchor={anchor}
              onEdit={onEditBlock ? handleStartEditBlock : undefined}
              onPin={onPinBlock}
            >
              <ReaderBlockWrap
                data-block-id={anchor.blockId}
                className={blockClasses(notedBlockIds, anchor.blockId)}
              >
                <Markdown
                  className="reader-flow"
                  contentWidth={measurePx}
                  autolink="gfm"
                  inlinePlugins={inlinePlugins}
                >
                  {segment.text}
                </Markdown>
              </ReaderBlockWrap>
            </EditableBlock>
          );
        })}
      </ReaderFlow>
    </ReaderArticle>
  );
}
