import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import type { MarkdownComponents } from "@astryxdesign/core/Markdown";
import type { BlockAnchor } from "@mdreadr/domain";
import { type ReactNode, useState } from "react";
import {
  ReaderBlockquote,
  ReaderCodeWrap,
  ReaderParagraph,
  readerHeadingByLevel,
} from "../ui/reader.tsx";
import { BadgeRow, parseBadgeBlock } from "./badges.tsx";
import { MathBlock } from "./math.tsx";
import { MermaidChart } from "./mermaid.tsx";

export type PinContext = {
  onPinBlock?: (anchor: BlockAnchor) => void;
  nextHeadingId: () => string;
  headingPathForLevel: (level: number, text: string) => string[];
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

function PinParagraph({
  children,
  onPinBlock,
}: {
  children: ReactNode;
  onPinBlock?: (anchor: BlockAnchor) => void;
}) {
  const [blockId] = useState(() => `paragraph-${crypto.randomUUID()}`);

  return (
    <ReaderParagraph
      data-block-id={blockId}
      onContextMenu={(event) => {
        if (!onPinBlock) return;
        event.preventDefault();
        onPinBlock({ kind: "paragraph", blockId });
      }}
    >
      {children}
    </ReaderParagraph>
  );
}

function PinCodeBlock({
  code,
  language,
  onPinBlock,
}: {
  code: string;
  language?: string;
  onPinBlock?: (anchor: BlockAnchor) => void;
}) {
  const [blockId] = useState(() => `code-${crypto.randomUUID()}`);

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

  return (
    <ReaderCodeWrap
      data-block-id={blockId}
      onContextMenu={(event) => {
        if (!onPinBlock) return;
        event.preventDefault();
        onPinBlock({ kind: "code", blockId });
      }}
    >
      <CodeBlock code={code} language={language} isCollapsible />
    </ReaderCodeWrap>
  );
}

export function createPinComponents(ctx: PinContext): Partial<MarkdownComponents> {
  return {
    heading({ level, children }) {
      const text = textFromChildren(children);
      const id = ctx.nextHeadingId();
      const headingPath = ctx.headingPathForLevel(level, text);

      const Heading = readerHeadingByLevel[level];

      return (
        <Heading
          id={id}
          data-block-id={id}
          onContextMenu={(event) => {
            if (!ctx.onPinBlock) return;
            event.preventDefault();
            ctx.onPinBlock({
              kind: "heading",
              blockId: id,
              headingPath,
            });
          }}
        >
          {children}
        </Heading>
      );
    },
    paragraph({ children }) {
      return <PinParagraph onPinBlock={ctx.onPinBlock}>{children}</PinParagraph>;
    },
    code({ code, language }) {
      return <PinCodeBlock code={code} language={language} onPinBlock={ctx.onPinBlock} />;
    },
    blockquote({ children }) {
      return <ReaderBlockquote>{children}</ReaderBlockquote>;
    },
  };
}
