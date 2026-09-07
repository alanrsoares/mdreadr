import { Markdown } from "@astryxdesign/core/Markdown";
import { type BlockAnchor, type Note, resolveBlockRawMarkdown } from "@mdreadr/domain";
import { useCallback, useMemo, useState } from "react";
import { createAnchorPlan, partitionReaderSegments } from "../markdown/anchors.ts";
import { blockClasses, createPinComponents } from "../markdown/pin-components.tsx";
import {
  createAssetResolver,
  createReaderInlinePlugins,
  preprocessReaderMarkdown,
} from "../markdown/pipeline.tsx";
import { useFontSettings } from "../theme/FontSettingsContext.tsx";
import { getReaderMeasurePx } from "../theme/measure.ts";
import { getApiBase } from "../treaty.ts";
import { EditBlockButton, PinButton } from "../ui/block-actions.tsx";
import { PinnableBlock } from "../ui/pinnable-block.tsx";
import { ReaderArticle, ReaderBlockWrap, ReaderFlow } from "../ui/reader.tsx";
import { InlineBlockEditor } from "./InlineBlockEditor.tsx";

type MarkdownViewProps = {
  content: string;
  notes: Note[];
  documentPath?: string;
  onPinBlock?: (anchor: BlockAnchor) => void;
  onEditBlock?: (anchor: BlockAnchor, newMarkdown: string) => void;
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

  const handleStartEditBlock = useCallback((anchor: BlockAnchor) => {
    setEditingBlockId(anchor.blockId);
  }, []);

  const handleCancelBlockEdit = useCallback(() => {
    setEditingBlockId(null);
  }, []);

  const handleSaveBlockEdit = useCallback(
    (anchor: BlockAnchor, newMarkdown: string) => {
      setEditingBlockId(null);
      onEditBlock?.(anchor, newMarkdown);
    },
    [onEditBlock],
  );

  const components = useMemo(
    () =>
      createPinComponents({
        onPinBlock,
        onStartEditBlock: onEditBlock ? handleStartEditBlock : undefined,
        editingBlockId,
        onSaveBlockEdit: handleSaveBlockEdit,
        onCancelBlockEdit: handleCancelBlockEdit,
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
      content,
      plan,
      notedBlockIds,
      resolveImageSrc,
    ],
  );

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
            const raw = content
              ? (resolveBlockRawMarkdown(content, anchor) ?? segment.text)
              : segment.text;
            return (
              <InlineBlockEditor
                key={segment.key}
                anchor={anchor}
                initialValue={raw}
                onSave={(newMarkdown) => handleSaveBlockEdit(anchor, newMarkdown)}
                onCancel={handleCancelBlockEdit}
              />
            );
          }

          return (
            <PinnableBlock
              key={segment.key}
              onDoubleClick={() => onEditBlock && handleStartEditBlock(anchor)}
            >
              {onEditBlock ? (
                <EditBlockButton anchor={anchor} onEdit={handleStartEditBlock} />
              ) : null}
              {onPinBlock ? <PinButton anchor={anchor} onPin={onPinBlock} /> : null}
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
            </PinnableBlock>
          );
        })}
      </ReaderFlow>
    </ReaderArticle>
  );
}
