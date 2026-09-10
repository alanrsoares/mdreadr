import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import type { MarkdownComponents } from "@astryxdesign/core/Markdown";
import {
  type BlockAnchor,
  resolveBlockRawMarkdown,
  resolveSubBlockRawMarkdown,
  type SubBlockTarget,
} from "@mdreadr/domain";
import { err, type Result } from "@onrails/result";
import type { ReactNode } from "react";
import { InlineBlockEditor } from "../components/InlineBlockEditor.tsx";
import type { BlockEditError } from "../session/inline-edit.ts";
import { EditableBlock } from "../ui/editable-block.tsx";
import {
  ReaderBlockquote,
  ReaderCodeWrap,
  ReaderParagraph,
  readerHeadingByLevel,
} from "../ui/reader.tsx";
import type { AnchorPlan } from "./anchors.ts";
import { type ImageSrcResolver, ReaderImage, renderSpecialFence } from "./pipeline.tsx";

export type PinContext = {
  onPinBlock?: (anchor: BlockAnchor) => void;
  onStartEditBlock?: (anchor: BlockAnchor) => void;
  /** Opens one part of a block with parts (a list item, a table row). */
  onStartEditSubBlock?: (anchor: BlockAnchor, target: SubBlockTarget) => void;
  editingBlockId?: string | null;
  /** Which part of the editing block is open, `null` for the whole block. */
  editingSubTarget?: SubBlockTarget | null;
  /** An `Err` leaves the editor open, showing why the edit did not apply. */
  onSaveBlockEdit?: (
    anchor: BlockAnchor,
    newMarkdown: string,
    target?: SubBlockTarget,
  ) => Result<void, BlockEditError>;
  onCancelBlockEdit?: () => void;
  onEditorDirtyChange?: (isDirty: boolean) => void;
  content?: string;
  plan: AnchorPlan;
  notedBlockIds: ReadonlySet<string>;
  resolveImageSrc?: ImageSrcResolver;
};

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    const props = children.props as { children?: ReactNode };
    return textFromChildren(props.children);
  }
  return "";
}

export const blockClasses = (notedBlockIds: ReadonlySet<string>, blockId: string): string =>
  notedBlockIds.has(blockId) ? "reader-block-has-note" : "";

type BlockSourceEditorProps = {
  anchor: BlockAnchor;
  /** Source to edit when the exact range cannot be resolved in the document. */
  fallback: string;
  /** Edits one part of the block rather than all of it. */
  target?: SubBlockTarget;
  ctx: PinContext;
};

/**
 * The inline editor for one anchored block, seeded with that block's exact
 * source range. Shared by every block kind so the seeding rule (real range,
 * else reconstructed fallback) lives in one place.
 */
export function BlockSourceEditor({ anchor, fallback, target, ctx }: BlockSourceEditorProps) {
  const resolve = (content: string): string | undefined =>
    target
      ? resolveSubBlockRawMarkdown(content, anchor, target)
      : resolveBlockRawMarkdown(content, anchor);
  const raw = ctx.content ? (resolve(ctx.content) ?? fallback) : fallback;

  return (
    <InlineBlockEditor
      anchor={anchor}
      subKind={target?.kind}
      initialValue={raw}
      onSave={(newMarkdown) =>
        ctx.onSaveBlockEdit?.(anchor, newMarkdown, target) ?? err({ _tag: "BlockNotFound" })
      }
      onCancel={() => ctx.onCancelBlockEdit?.()}
      onDirtyChange={ctx.onEditorDirtyChange}
    />
  );
}

type PinParagraphProps = {
  children: ReactNode;
  ctx: PinContext;
};

function PinParagraph({ children, ctx }: PinParagraphProps) {
  const text = textFromChildren(children);
  const anchor = ctx.plan.nextParagraph(text);
  const blockId = anchor.blockId;

  if (ctx.editingBlockId === blockId) {
    return <BlockSourceEditor anchor={anchor} fallback={text} ctx={ctx} />;
  }

  return (
    <EditableBlock
      anchor={anchor}
      onEdit={ctx.onStartEditBlock}
      onPin={ctx.onPinBlock}
      content={ctx.content}
    >
      <ReaderParagraph data-block-id={blockId} className={blockClasses(ctx.notedBlockIds, blockId)}>
        {children}
      </ReaderParagraph>
    </EditableBlock>
  );
}

type PinCodeBlockProps = {
  code: string;
  language?: string;
  ctx: PinContext;
};

function PinCodeBlock({ code, language, ctx }: PinCodeBlockProps) {
  const special = renderSpecialFence(language, code, { resolveImageSrc: ctx.resolveImageSrc });
  if (special !== null) return special;

  const anchor = ctx.plan.nextCode(code, language);
  const blockId = anchor.blockId;

  if (ctx.editingBlockId === blockId) {
    const fallback = `\`\`\`${language ?? ""}\n${code}\n\`\`\``;
    return <BlockSourceEditor anchor={anchor} fallback={fallback} ctx={ctx} />;
  }

  return (
    <EditableBlock
      anchor={anchor}
      onEdit={ctx.onStartEditBlock}
      onPin={ctx.onPinBlock}
      content={ctx.content}
    >
      <ReaderCodeWrap data-block-id={blockId} className={blockClasses(ctx.notedBlockIds, blockId)}>
        <CodeBlock code={code} language={language} isCollapsible />
      </ReaderCodeWrap>
    </EditableBlock>
  );
}

export const createPinComponents = (ctx: PinContext): Partial<MarkdownComponents> => ({
  heading({ level, children }) {
    const text = textFromChildren(children);
    const { anchor, domId } = ctx.plan.nextHeading(level, text);

    if (ctx.editingBlockId === anchor.blockId) {
      return (
        <BlockSourceEditor anchor={anchor} fallback={`${"#".repeat(level)} ${text}`} ctx={ctx} />
      );
    }

    const Heading = readerHeadingByLevel[level];

    return (
      <EditableBlock
        anchor={anchor}
        onEdit={ctx.onStartEditBlock}
        onPin={ctx.onPinBlock}
        content={ctx.content}
      >
        <Heading
          id={domId}
          data-block-id={domId}
          className={blockClasses(ctx.notedBlockIds, domId)}
        >
          {children}
        </Heading>
      </EditableBlock>
    );
  },
  paragraph({ children }) {
    return <PinParagraph ctx={ctx}>{children}</PinParagraph>;
  },
  code({ code, language }) {
    return <PinCodeBlock code={code} language={language} ctx={ctx} />;
  },
  image({ src, alt }) {
    return <ReaderImage src={src} alt={alt} resolveImageSrc={ctx.resolveImageSrc} />;
  },
  blockquote({ children }) {
    return <ReaderBlockquote>{children}</ReaderBlockquote>;
  },
});
