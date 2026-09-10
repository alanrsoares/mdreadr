import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import type { MarkdownComponents } from "@astryxdesign/core/Markdown";
import {
  type BlockAnchor,
  resolveBlockRawMarkdown,
  resolveSubBlockRawMarkdown,
  type SubBlockTarget,
} from "@mdreadr/domain";
import type { ReactNode } from "react";
import { InlineBlockEditor } from "../components/InlineBlockEditor.tsx";
import { type InlineEditHandle, isBlockOpen } from "../session/inline-edit.ts";
import { EditableBlock } from "../ui/editable-block.tsx";
import {
  ReaderBlockquote,
  ReaderCodeWrap,
  ReaderParagraph,
  readerHeadingByLevel,
} from "../ui/reader.tsx";
import { ReaderImage, renderSpecialFence } from "./pipeline.tsx";
import type { RenderContext } from "./render-context.ts";

/**
 * The two things every pinnable block is handed: what to draw, and what the
 * reader can do about editing it. Kept apart on purpose — a keystroke in the
 * open editor changes only the second.
 */
type PinProps = {
  render: RenderContext;
  edit: InlineEditHandle;
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

type BlockSourceEditorProps = PinProps & {
  anchor: BlockAnchor;
  /** Source to edit when the exact range cannot be resolved in the document. */
  fallback: string;
  /** Edits one part of the block rather than all of it. */
  target?: SubBlockTarget;
};

/**
 * The inline editor for one anchored block, seeded with that block's exact
 * source range. Shared by every block kind so the seeding rule (real range,
 * else reconstructed fallback) lives in one place.
 */
export function BlockSourceEditor({
  anchor,
  fallback,
  target,
  render,
  edit,
}: BlockSourceEditorProps) {
  const resolved = target
    ? resolveSubBlockRawMarkdown(render.content, anchor, target)
    : resolveBlockRawMarkdown(render.content, anchor);

  return (
    <InlineBlockEditor
      anchor={anchor}
      subKind={target?.kind}
      initialValue={resolved ?? fallback}
      onSave={(newMarkdown) => edit.apply(anchor, newMarkdown, target)}
      onCancel={edit.cancel}
      onDirtyChange={edit.dirtyChanged}
    />
  );
}

type PinParagraphProps = PinProps & {
  children: ReactNode;
};

function PinParagraph({ children, render, edit }: PinParagraphProps) {
  const text = textFromChildren(children);
  const anchor = render.plan.nextParagraph(text);
  const blockId = anchor.blockId;

  if (isBlockOpen(edit.open, blockId)) {
    return <BlockSourceEditor anchor={anchor} fallback={text} render={render} edit={edit} />;
  }

  return (
    <EditableBlock anchor={anchor} edit={edit} content={render.content} onPin={render.onPinBlock}>
      <ReaderParagraph
        data-block-id={blockId}
        className={blockClasses(render.notedBlockIds, blockId)}
      >
        {children}
      </ReaderParagraph>
    </EditableBlock>
  );
}

type PinCodeBlockProps = PinProps & {
  code: string;
  language?: string;
};

function PinCodeBlock({ code, language, render, edit }: PinCodeBlockProps) {
  const special = renderSpecialFence(language, code, { resolveImageSrc: render.resolveImageSrc });
  if (special !== null) return special;

  const anchor = render.plan.nextCode(code, language);
  const blockId = anchor.blockId;

  if (isBlockOpen(edit.open, blockId)) {
    const fallback = `\`\`\`${language ?? ""}\n${code}\n\`\`\``;
    return <BlockSourceEditor anchor={anchor} fallback={fallback} render={render} edit={edit} />;
  }

  return (
    <EditableBlock anchor={anchor} edit={edit} content={render.content} onPin={render.onPinBlock}>
      <ReaderCodeWrap
        data-block-id={blockId}
        className={blockClasses(render.notedBlockIds, blockId)}
      >
        <CodeBlock code={code} language={language} isCollapsible />
      </ReaderCodeWrap>
    </EditableBlock>
  );
}

export const createPinComponents = ({ render, edit }: PinProps): Partial<MarkdownComponents> => ({
  heading({ level, children }) {
    const text = textFromChildren(children);
    const { anchor, domId } = render.plan.nextHeading(level, text);

    if (isBlockOpen(edit.open, anchor.blockId)) {
      return (
        <BlockSourceEditor
          anchor={anchor}
          fallback={`${"#".repeat(level)} ${text}`}
          render={render}
          edit={edit}
        />
      );
    }

    const Heading = readerHeadingByLevel[level];

    return (
      <EditableBlock anchor={anchor} edit={edit} content={render.content} onPin={render.onPinBlock}>
        <Heading
          id={domId}
          data-block-id={domId}
          className={blockClasses(render.notedBlockIds, domId)}
        >
          {children}
        </Heading>
      </EditableBlock>
    );
  },
  paragraph({ children }) {
    return (
      <PinParagraph render={render} edit={edit}>
        {children}
      </PinParagraph>
    );
  },
  code({ code, language }) {
    return <PinCodeBlock code={code} language={language} render={render} edit={edit} />;
  },
  image({ src, alt }) {
    return <ReaderImage src={src} alt={alt} resolveImageSrc={render.resolveImageSrc} />;
  },
  blockquote({ children }) {
    return <ReaderBlockquote>{children}</ReaderBlockquote>;
  },
});
