import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import type { MarkdownComponents } from "@astryxdesign/core/Markdown";
import { type BlockAnchor, resolveBlockRawMarkdown } from "@mdreadr/domain";
import type { ReactNode } from "react";
import { InlineBlockEditor } from "../components/InlineBlockEditor.tsx";
import { EditBlockButton, PinButton } from "../ui/block-actions.tsx";
import { PinnableBlock } from "../ui/pinnable-block.tsx";
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
  editingBlockId?: string | null;
  onSaveBlockEdit?: (anchor: BlockAnchor, newMarkdown: string) => void;
  onCancelBlockEdit?: () => void;
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

const blockClasses = (notedBlockIds: ReadonlySet<string>, blockId: string): string =>
  notedBlockIds.has(blockId) ? "reader-block-has-note" : "";

type PinParagraphProps = {
  children: ReactNode;
  onPinBlock?: (anchor: BlockAnchor) => void;
  onStartEditBlock?: (anchor: BlockAnchor) => void;
  editingBlockId?: string | null;
  onSaveBlockEdit?: (anchor: BlockAnchor, newMarkdown: string) => void;
  onCancelBlockEdit?: () => void;
  content?: string;
  plan: AnchorPlan;
  notedBlockIds: ReadonlySet<string>;
};

function PinParagraph({
  children,
  onPinBlock,
  onStartEditBlock,
  editingBlockId,
  onSaveBlockEdit,
  onCancelBlockEdit,
  content,
  plan,
  notedBlockIds,
}: PinParagraphProps) {
  const text = textFromChildren(children);
  const anchor = plan.nextParagraph(text);
  const blockId = anchor.blockId;

  if (editingBlockId === blockId) {
    const raw = content ? (resolveBlockRawMarkdown(content, anchor) ?? text) : text;
    return (
      <InlineBlockEditor
        anchor={anchor}
        initialValue={raw}
        onSave={(newMarkdown) => onSaveBlockEdit?.(anchor, newMarkdown)}
        onCancel={() => onCancelBlockEdit?.()}
      />
    );
  }

  return (
    <PinnableBlock onDoubleClick={() => onStartEditBlock?.(anchor)}>
      {onStartEditBlock ? <EditBlockButton anchor={anchor} onEdit={onStartEditBlock} /> : null}
      {onPinBlock ? <PinButton anchor={anchor} onPin={onPinBlock} /> : null}
      <ReaderParagraph data-block-id={blockId} className={blockClasses(notedBlockIds, blockId)}>
        {children}
      </ReaderParagraph>
    </PinnableBlock>
  );
}

type PinCodeBlockProps = {
  code: string;
  language?: string;
  onPinBlock?: (anchor: BlockAnchor) => void;
  onStartEditBlock?: (anchor: BlockAnchor) => void;
  editingBlockId?: string | null;
  onSaveBlockEdit?: (anchor: BlockAnchor, newMarkdown: string) => void;
  onCancelBlockEdit?: () => void;
  content?: string;
  plan: AnchorPlan;
  notedBlockIds: ReadonlySet<string>;
  resolveImageSrc?: ImageSrcResolver;
};

function PinCodeBlock({
  code,
  language,
  onPinBlock,
  onStartEditBlock,
  editingBlockId,
  onSaveBlockEdit,
  onCancelBlockEdit,
  content,
  plan,
  notedBlockIds,
  resolveImageSrc,
}: PinCodeBlockProps) {
  const special = renderSpecialFence(language, code, { resolveImageSrc });
  if (special !== null) return special;

  const anchor = plan.nextCode(code, language);
  const blockId = anchor.blockId;

  if (editingBlockId === blockId) {
    const fallback = `\`\`\`${language ?? ""}\n${code}\n\`\`\``;
    const raw = content ? (resolveBlockRawMarkdown(content, anchor) ?? fallback) : fallback;
    return (
      <InlineBlockEditor
        anchor={anchor}
        initialValue={raw}
        onSave={(newMarkdown) => onSaveBlockEdit?.(anchor, newMarkdown)}
        onCancel={() => onCancelBlockEdit?.()}
      />
    );
  }

  return (
    <PinnableBlock onDoubleClick={() => onStartEditBlock?.(anchor)}>
      {onStartEditBlock ? <EditBlockButton anchor={anchor} onEdit={onStartEditBlock} /> : null}
      {onPinBlock ? <PinButton anchor={anchor} onPin={onPinBlock} /> : null}
      <ReaderCodeWrap data-block-id={blockId} className={blockClasses(notedBlockIds, blockId)}>
        <CodeBlock code={code} language={language} isCollapsible />
      </ReaderCodeWrap>
    </PinnableBlock>
  );
}

export const createPinComponents = (ctx: PinContext): Partial<MarkdownComponents> => ({
  heading({ level, children }) {
    const text = textFromChildren(children);
    const { anchor, domId } = ctx.plan.nextHeading(level, text);

    if (ctx.editingBlockId === anchor.blockId) {
      const fallback = `${"#".repeat(level)} ${text}`;
      const raw = ctx.content
        ? (resolveBlockRawMarkdown(ctx.content, anchor) ?? fallback)
        : fallback;
      return (
        <InlineBlockEditor
          anchor={anchor}
          initialValue={raw}
          onSave={(newMarkdown) => ctx.onSaveBlockEdit?.(anchor, newMarkdown)}
          onCancel={() => ctx.onCancelBlockEdit?.()}
        />
      );
    }

    const Heading = readerHeadingByLevel[level];

    return (
      <PinnableBlock onDoubleClick={() => ctx.onStartEditBlock?.(anchor)}>
        {ctx.onStartEditBlock ? (
          <EditBlockButton anchor={anchor} onEdit={ctx.onStartEditBlock} />
        ) : null}
        {ctx.onPinBlock ? <PinButton anchor={anchor} onPin={ctx.onPinBlock} /> : null}
        <Heading
          id={domId}
          data-block-id={domId}
          className={blockClasses(ctx.notedBlockIds, domId)}
        >
          {children}
        </Heading>
      </PinnableBlock>
    );
  },
  paragraph({ children }) {
    return (
      <PinParagraph
        onPinBlock={ctx.onPinBlock}
        onStartEditBlock={ctx.onStartEditBlock}
        editingBlockId={ctx.editingBlockId}
        onSaveBlockEdit={ctx.onSaveBlockEdit}
        onCancelBlockEdit={ctx.onCancelBlockEdit}
        content={ctx.content}
        plan={ctx.plan}
        notedBlockIds={ctx.notedBlockIds}
      >
        {children}
      </PinParagraph>
    );
  },
  code({ code, language }) {
    return (
      <PinCodeBlock
        code={code}
        language={language}
        onPinBlock={ctx.onPinBlock}
        onStartEditBlock={ctx.onStartEditBlock}
        editingBlockId={ctx.editingBlockId}
        onSaveBlockEdit={ctx.onSaveBlockEdit}
        onCancelBlockEdit={ctx.onCancelBlockEdit}
        content={ctx.content}
        plan={ctx.plan}
        notedBlockIds={ctx.notedBlockIds}
        resolveImageSrc={ctx.resolveImageSrc}
      />
    );
  },
  image({ src, alt }) {
    return <ReaderImage src={src} alt={alt} resolveImageSrc={ctx.resolveImageSrc} />;
  },
  blockquote({ children }) {
    return <ReaderBlockquote>{children}</ReaderBlockquote>;
  },
});
