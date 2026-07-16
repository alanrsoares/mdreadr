import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import type { MarkdownComponents } from "@astryxdesign/core/Markdown";
import type { BlockAnchor } from "@mdreadr/domain";
import type { ReactNode } from "react";
import { PinButton } from "../ui/pin-button.tsx";
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

function PinParagraph({
  children,
  onPinBlock,
  plan,
  notedBlockIds,
}: {
  children: ReactNode;
  onPinBlock?: (anchor: BlockAnchor) => void;
  plan: AnchorPlan;
  notedBlockIds: ReadonlySet<string>;
}) {
  const text = textFromChildren(children);
  const anchor = plan.nextParagraph(text);
  const blockId = anchor.blockId;

  return (
    <PinnableBlock>
      {onPinBlock ? <PinButton anchor={anchor} onPin={onPinBlock} /> : null}
      <ReaderParagraph data-block-id={blockId} className={blockClasses(notedBlockIds, blockId)}>
        {children}
      </ReaderParagraph>
    </PinnableBlock>
  );
}

function PinCodeBlock({
  code,
  language,
  onPinBlock,
  plan,
  notedBlockIds,
  resolveImageSrc,
}: {
  code: string;
  language?: string;
  onPinBlock?: (anchor: BlockAnchor) => void;
  plan: AnchorPlan;
  notedBlockIds: ReadonlySet<string>;
  resolveImageSrc?: ImageSrcResolver;
}) {
  const special = renderSpecialFence(language, code, { resolveImageSrc });
  if (special !== null) return special;

  const anchor = plan.nextCode(code, language);
  const blockId = anchor.blockId;

  return (
    <PinnableBlock>
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

    const Heading = readerHeadingByLevel[level];

    return (
      <PinnableBlock>
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
      <PinParagraph onPinBlock={ctx.onPinBlock} plan={ctx.plan} notedBlockIds={ctx.notedBlockIds}>
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
