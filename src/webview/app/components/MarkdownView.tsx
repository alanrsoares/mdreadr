import { Markdown } from "@astryxdesign/core/Markdown";
import type { BlockAnchor, Note, SubBlockTarget } from "@mdreadr/domain";
import { match } from "@onrails/pattern";
import { err, isErr, type Result } from "@onrails/result";
import { Fragment, type MouseEvent, memo, useCallback, useMemo, useRef, useState } from "react";
import {
  callAttentionToInlineEditor,
  createAnchorPlan,
  focusBlockAtIndex,
  indexOfBlock,
  partitionReaderSegments,
  scrollToHeadingSlug,
} from "../markdown/anchors.ts";
import { resolveReaderLink } from "../markdown/document-links.ts";
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
import { remapSubBlockTargetFromAfter, splitAroundSubBlock } from "../markdown/sub-blocks.ts";
import {
  type BlockEditError,
  type InlineEditState,
  openInlineEdit,
  openTargetIn,
} from "../session/inline-edit.ts";
import { openExternalLink } from "../session/open-external.ts";
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
  onEditBlock?: (
    anchor: BlockAnchor,
    newMarkdown: string,
    target?: SubBlockTarget,
  ) => Result<void, BlockEditError>;
  /** Opens another Document in a Tab, for links between markdown files. */
  onOpenDocument?: (path: string) => void;
};

export const MarkdownView = memo(function MarkdownView({
  content,
  notes,
  documentPath,
  onPinBlock,
  onEditBlock,
  onOpenDocument,
}: MarkdownViewProps) {
  const { readerFontSize, readerFontFamily } = useFontSettings();
  const measurePx = getReaderMeasurePx(readerFontSize, readerFontFamily);
  /** The open Inline Edit. Every decision about it — the one-at-a-time rule,
   *  the refusal, the index focus returns to — lives in `session/inline-edit`. */
  const [openEdit, setOpenEdit] = useState<InlineEditState>(null);
  const editingBlockId = openEdit?.blockId ?? null;
  // Dirtiness rides in a ref rather than in the state beside it: it changes on
  // every keystroke, and rendering on that would rebuild the whole Document.
  const isEditorDirtyRef = useRef(false);

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

  /**
   * Links are handled here, delegated, rather than through a `link` component
   * override: list and table segments render without the override, and that is
   * exactly where a Document's links to its neighbours tend to live.
   */
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const link = event.target instanceof HTMLElement ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;

      // The attribute, not `link.href`: the DOM resolves a relative href
      // against the webview's own bundle url (`views://mainview/CONTEXT.md`),
      // which is exactly the navigation being prevented.
      const target = resolveReaderLink(link.getAttribute("href") ?? "", documentPath);

      match(target)
        // Left to the browser: absolute urls, other file types, unresolvable
        // relative paths.
        .with({ kind: "other" }, () => undefined)
        .with({ kind: "fragment" }, ({ id }) => {
          event.preventDefault();
          scrollToHeadingSlug(id);
        })
        .with({ kind: "document" }, ({ path }) => {
          // Prevented even with no handler wired: following the link would
          // navigate the app off its own bundle and lose the session.
          event.preventDefault();
          onOpenDocument?.(path);
        })
        .with({ kind: "external" }, ({ url }) => {
          event.preventDefault();
          void openExternalLink(url);
        })
        .exhaustive();
    },
    [documentPath, onOpenDocument],
  );

  /** Fills in the native tooltip the first time a link is hovered: a reader
   *  cannot otherwise see where a link goes, and there is no status bar. */
  const handleMouseOver = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const link = event.target instanceof HTMLElement ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.title) return;

      const href = link.getAttribute("href") ?? "";
      const target = resolveReaderLink(href, documentPath);
      link.title = match(target)
        .with({ kind: "external" }, ({ url }) => url)
        .with({ kind: "document" }, ({ path }) => path)
        .with({ kind: "fragment" }, ({ id }) => `On this page: ${id}`)
        .with({ kind: "other" }, () => href)
        .exhaustive();
    },
    [documentPath],
  );

  const handleEditorDirtyChange = useCallback((isDirty: boolean) => {
    isEditorDirtyRef.current = isDirty;
  }, []);

  /** Hands focus from the closing editor back to the block it replaced. Two
   *  frames: the first is React's commit, the second is when the restored block
   *  is really in the DOM to receive focus. */
  const returnFocusToBlock = useCallback((index: number, flashClassName?: string) => {
    if (index < 0) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => focusBlockAtIndex(index, flashClassName));
    });
  }, []);

  const startEditing = useCallback(
    (anchor: BlockAnchor, target: SubBlockTarget | null) => {
      const opened = openInlineEdit(
        { open: openEdit, isDirty: isEditorDirtyRef.current },
        { blockId: anchor.blockId, target, returnIndex: indexOfBlock(anchor.blockId) },
      );
      if (isErr(opened)) {
        // Refused: the open editor holds the only copy of its text, so it gets
        // the nudge rather than being replaced by the block that asked.
        callAttentionToInlineEditor();
        return;
      }
      setOpenEdit(opened.value);
    },
    [openEdit],
  );

  const handleStartEditBlock = useCallback(
    (anchor: BlockAnchor) => startEditing(anchor, null),
    [startEditing],
  );

  const handleStartEditSubBlock = useCallback(
    (anchor: BlockAnchor, target: SubBlockTarget) => startEditing(anchor, target),
    [startEditing],
  );

  const handleCancelBlockEdit = useCallback(() => {
    const returnIndex = openEdit?.returnIndex ?? -1;
    setOpenEdit(null);
    returnFocusToBlock(returnIndex);
  }, [openEdit, returnFocusToBlock]);

  const handleSaveBlockEdit = useCallback(
    (
      anchor: BlockAnchor,
      newMarkdown: string,
      target?: SubBlockTarget,
    ): Result<void, BlockEditError> => {
      const applied = onEditBlock?.(anchor, newMarkdown, target) ?? err({ _tag: "BlockNotFound" });
      if (isErr(applied)) return applied;
      const returnIndex = openEdit?.returnIndex ?? -1;
      setOpenEdit(null);
      returnFocusToBlock(returnIndex, "reader-block-edit-flash");
      return applied;
    },
    [onEditBlock, openEdit, returnFocusToBlock],
  );

  const pinContext = useMemo(
    () => ({
      onPinBlock,
      onStartEditBlock: onEditBlock ? handleStartEditBlock : undefined,
      onStartEditSubBlock: onEditBlock ? handleStartEditSubBlock : undefined,
      editingBlockId,
      editingSubTarget: openEdit?.target ?? null,
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
      handleStartEditSubBlock,
      editingBlockId,
      openEdit,
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
    <ReaderArticle onClick={handleClick} onMouseOver={handleMouseOver}>
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
          const subKind = isList ? ("list-item" as const) : ("table-row" as const);
          const editingTarget = openTargetIn(openEdit, anchor.blockId);
          // A part of the block is open: the rest of it stays rendered around
          // the editor, sliced out of the block's own source so ordered markers
          // keep their numbers and the table keeps its columns.
          const split = editingTarget
            ? splitAroundSubBlock(segment.text, editingTarget)
            : undefined;

          if (editingBlockId === anchor.blockId) {
            return (
              <Fragment key={segment.key}>
                {split?.before ? (
                  <EditableBlock
                    anchor={anchor}
                    onEdit={onEditBlock ? handleStartEditBlock : undefined}
                    onEditSub={onEditBlock ? handleStartEditSubBlock : undefined}
                    subKind={subKind}
                    onPin={onPinBlock}
                    content={content}
                  >
                    <Markdown
                      className="reader-flow"
                      contentWidth={measurePx}
                      autolink="gfm"
                      inlinePlugins={inlinePlugins}
                    >
                      {split.before}
                    </Markdown>
                  </EditableBlock>
                ) : null}
                <BlockSourceEditor
                  anchor={anchor}
                  // No split: the whole block is being edited, or the part it
                  // named is gone, and the block's source is the honest seed.
                  {...(split && editingTarget ? { target: editingTarget } : {})}
                  fallback={split?.source ?? segment.text}
                  ctx={pinContext}
                />
                {split?.after ? (
                  <EditableBlock
                    anchor={anchor}
                    onEdit={onEditBlock ? handleStartEditBlock : undefined}
                    onEditSub={onEditBlock ? handleStartEditSubBlock : undefined}
                    mapSubTarget={(target) =>
                      editingTarget
                        ? remapSubBlockTargetFromAfter(segment.text, editingTarget, target)
                        : target
                    }
                    subKind={subKind}
                    onPin={onPinBlock}
                    content={content}
                  >
                    <Markdown
                      className="reader-flow"
                      contentWidth={measurePx}
                      autolink="gfm"
                      inlinePlugins={inlinePlugins}
                    >
                      {split.after}
                    </Markdown>
                  </EditableBlock>
                ) : null}
              </Fragment>
            );
          }

          return (
            <EditableBlock
              key={segment.key}
              anchor={anchor}
              onEdit={onEditBlock ? handleStartEditBlock : undefined}
              onEditSub={onEditBlock ? handleStartEditSubBlock : undefined}
              subKind={subKind}
              onPin={onPinBlock}
              content={content}
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
});
