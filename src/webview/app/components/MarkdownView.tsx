import { Markdown } from "@astryxdesign/core/Markdown";
import type { BlockAnchor, Note, SubBlockTarget } from "@mdreadr/domain";
import { match } from "@onrails/pattern";
import { err, isErr, type Result } from "@onrails/result";
import { Fragment, type MouseEvent, useCallback, useMemo, useRef, useState } from "react";
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
import { sameSubBlockTarget, splitAroundSubBlock } from "../markdown/sub-blocks.ts";
import type { BlockEditError } from "../session/block-edit.ts";
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

export function MarkdownView({
  content,
  notes,
  documentPath,
  onPinBlock,
  onEditBlock,
  onOpenDocument,
}: MarkdownViewProps) {
  const { readerFontSize, readerFontFamily } = useFontSettings();
  const measurePx = getReaderMeasurePx(readerFontSize, readerFontFamily);
  /** The open inline editor: which block, and which part of it (`null` for the
   *  whole block). One at a time, so a second one cannot discard the first. */
  const [editing, setEditing] = useState<{
    blockId: string;
    target: SubBlockTarget | null;
  } | null>(null);
  const editingBlockId = editing?.blockId ?? null;
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

  const startEditing = useCallback(
    (anchor: BlockAnchor, target: SubBlockTarget | null) => {
      // Only one editor is open at a time, so opening a second would silently
      // discard the first one's text. The open editor gets the nudge. A second
      // part of the *same* block is the same block, and its editor is the one
      // being replaced, so that too has to be refused while dirty.
      const isSame =
        editing?.blockId === anchor.blockId && sameSubBlockTarget(editing.target, target);
      if (editing && !isSame && isEditorDirtyRef.current) {
        callAttentionToInlineEditor();
        return;
      }
      editingIndexRef.current = indexOfBlock(anchor.blockId);
      setEditing({ blockId: anchor.blockId, target });
    },
    [editing],
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
    setEditing(null);
    returnFocusToBlock();
  }, [returnFocusToBlock]);

  const handleSaveBlockEdit = useCallback(
    (
      anchor: BlockAnchor,
      newMarkdown: string,
      target?: SubBlockTarget,
    ): Result<void, BlockEditError> => {
      const applied = onEditBlock?.(anchor, newMarkdown, target) ?? err({ _tag: "BlockNotFound" });
      if (isErr(applied)) return applied;
      setEditing(null);
      returnFocusToBlock("reader-block-edit-flash");
      return applied;
    },
    [onEditBlock, returnFocusToBlock],
  );

  const pinContext = useMemo(
    () => ({
      onPinBlock,
      onStartEditBlock: onEditBlock ? handleStartEditBlock : undefined,
      onStartEditSubBlock: onEditBlock ? handleStartEditSubBlock : undefined,
      editingBlockId,
      editingSubTarget: editing?.target ?? null,
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
      editing,
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
          const editingTarget = editingBlockId === anchor.blockId ? editing?.target : undefined;
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
                  <Markdown
                    className="reader-flow"
                    contentWidth={measurePx}
                    autolink="gfm"
                    inlinePlugins={inlinePlugins}
                  >
                    {split.before}
                  </Markdown>
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
                  <Markdown
                    className="reader-flow"
                    contentWidth={measurePx}
                    autolink="gfm"
                    inlinePlugins={inlinePlugins}
                  >
                    {split.after}
                  </Markdown>
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
}
