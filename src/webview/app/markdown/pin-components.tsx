import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import type { MarkdownComponents } from "@astryxdesign/core/Markdown";
import type { BlockAnchor } from "@mdreadr/domain";
import { truncateAnchorLabel } from "@mdreadr/domain";
import type { ReactNode } from "react";
import { PinButton } from "../ui/pin-button.tsx";
import { PinnableBlock } from "../ui/pinnable-block.tsx";
import {
  ReaderBlockquote,
  ReaderCodeWrap,
  ReaderParagraph,
  readerHeadingByLevel,
} from "../ui/reader.tsx";
import { BadgeRow, parseBadgeBlock } from "./badges.tsx";
import type { BlockIdAllocator } from "./block-ids.ts";
import { MathBlock } from "./math.tsx";
import { MermaidChart } from "./mermaid.tsx";

export type PinContext = {
  onPinBlock?: (anchor: BlockAnchor) => void;
  nextHeadingId: () => string;
  headingPathForLevel: (level: number, text: string) => string[];
  blockIds: BlockIdAllocator;
  notedBlockIds: ReadonlySet<string>;
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

function blockClasses(notedBlockIds: ReadonlySet<string>, blockId: string): string {
  return notedBlockIds.has(blockId) ? "reader-block-has-note" : "";
}

function PinParagraph({
  children,
  onPinBlock,
  blockIds,
  notedBlockIds,
}: {
  children: ReactNode;
  onPinBlock?: (anchor: BlockAnchor) => void;
  blockIds: BlockIdAllocator;
  notedBlockIds: ReadonlySet<string>;
}) {
  const text = textFromChildren(children);
  const blockId = blockIds.nextParagraphId(text);
  const anchor: BlockAnchor = {
    kind: "paragraph",
    blockId,
    label: truncateAnchorLabel(text),
  };

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
  blockIds,
  notedBlockIds,
}: {
  code: string;
  language?: string;
  onPinBlock?: (anchor: BlockAnchor) => void;
  blockIds: BlockIdAllocator;
  notedBlockIds: ReadonlySet<string>;
}) {
  if (language === "mermaid") {
    return <MermaidChart chart={code} />;
  }

  if (language === "math") {
    return <MathBlock tex={code} />;
  }

  if (language === "badges") {
    const badges = parseBadgeBlock(code);
    if (badges) {
      return <BadgeRow badges={badges} />;
    }
  }

  const blockId = blockIds.nextCodeId(code, language);
  const anchor: BlockAnchor = {
    kind: "code",
    blockId,
    label: truncateAnchorLabel(code.split("\n")[0] ?? code),
  };

  return (
    <PinnableBlock>
      {onPinBlock ? <PinButton anchor={anchor} onPin={onPinBlock} /> : null}
      <ReaderCodeWrap data-block-id={blockId} className={blockClasses(notedBlockIds, blockId)}>
        <CodeBlock code={code} language={language} isCollapsible />
      </ReaderCodeWrap>
    </PinnableBlock>
  );
}

export function createPinComponents(ctx: PinContext): Partial<MarkdownComponents> {
  return {
    heading({ level, children }) {
      const text = textFromChildren(children);
      const id = ctx.nextHeadingId();
      const headingPath = ctx.headingPathForLevel(level, text);
      const anchor: BlockAnchor = {
        kind: "heading",
        blockId: id,
        headingPath,
        label: truncateAnchorLabel(text),
      };

      const Heading = readerHeadingByLevel[level];

      return (
        <PinnableBlock>
          {ctx.onPinBlock ? <PinButton anchor={anchor} onPin={ctx.onPinBlock} /> : null}
          <Heading id={id} data-block-id={id} className={blockClasses(ctx.notedBlockIds, id)}>
            {children}
          </Heading>
        </PinnableBlock>
      );
    },
    paragraph({ children }) {
      return (
        <PinParagraph
          onPinBlock={ctx.onPinBlock}
          blockIds={ctx.blockIds}
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
          blockIds={ctx.blockIds}
          notedBlockIds={ctx.notedBlockIds}
        />
      );
    },
    blockquote({ children }) {
      return <ReaderBlockquote>{children}</ReaderBlockquote>;
    },
  };
}
