import { Markdown } from "@astryxdesign/core/Markdown";
import type { BlockAnchor, Note } from "@mdreadr/domain";
import { blockIdForHeading, extractHeadings } from "@mdreadr/domain";
import { useMemo, useRef } from "react";
import { linkedBadgePlugin } from "../markdown/badges.tsx";
import { createBlockIdAllocator } from "../markdown/block-ids.ts";
import { inlineMathPlugin } from "../markdown/math.tsx";
import { createPinComponents } from "../markdown/pin-components.tsx";
import { preprocessReaderMarkdown } from "../markdown/preprocess.ts";
import { ReaderArticle } from "../ui/reader.tsx";

type MarkdownViewProps = {
  content: string;
  notes: Note[];
  onPinBlock?: (anchor: BlockAnchor) => void;
};

function headingPathForLevel(
  stack: { level: number; text: string }[],
  level: number,
  text: string,
): string[] {
  while (stack.length > 0 && (stack.at(-1)?.level ?? 0) >= level) {
    stack.pop();
  }
  stack.push({ level, text });
  return stack.map((item) => item.text);
}

export function MarkdownView({ content, notes, onPinBlock }: MarkdownViewProps) {
  const headingStackRef = useRef<{ level: number; text: string }[]>([]);
  const headingIndexRef = useRef(0);
  const headings = useMemo(() => extractHeadings(content), [content]);
  const prepared = useMemo(() => preprocessReaderMarkdown(content), [content]);
  const blockIds = useMemo(() => createBlockIdAllocator(prepared), [prepared]);
  const notedBlockIds = useMemo(() => new Set(notes.map((note) => note.anchor.blockId)), [notes]);

  const contentKeyRef = useRef(content);
  if (contentKeyRef.current !== content) {
    contentKeyRef.current = content;
    headingIndexRef.current = 0;
    headingStackRef.current = [];
  }

  const components = useMemo(() => {
    const nextHeadingId = () => {
      const entry = headings[headingIndexRef.current];
      headingIndexRef.current += 1;
      return entry ? blockIdForHeading(entry) : `heading-${headingIndexRef.current}`;
    };

    return createPinComponents({
      onPinBlock,
      nextHeadingId,
      headingPathForLevel: (level, text) =>
        headingPathForLevel(headingStackRef.current, level, text),
      blockIds,
      notedBlockIds,
    });
  }, [blockIds, headings, notedBlockIds, onPinBlock]);

  return (
    <ReaderArticle>
      <Markdown
        key={content}
        className="reader-flow"
        contentWidth={680}
        autolink="gfm"
        components={components}
        inlinePlugins={[linkedBadgePlugin, inlineMathPlugin]}
      >
        {prepared}
      </Markdown>
    </ReaderArticle>
  );
}
