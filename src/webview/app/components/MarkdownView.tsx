import { Markdown } from "@astryxdesign/core/Markdown";
import type { BlockAnchor, Note } from "@mdreadr/domain";
import { useMemo } from "react";
import { createAnchorPlan } from "../markdown/anchors.ts";
import { createPinComponents } from "../markdown/pin-components.tsx";
import {
  createAssetResolver,
  createReaderInlinePlugins,
  preprocessReaderMarkdown,
} from "../markdown/pipeline.tsx";
import { getApiBase } from "../treaty.ts";
import { ReaderArticle } from "../ui/reader.tsx";

type MarkdownViewProps = {
  content: string;
  notes: Note[];
  documentPath?: string;
  onPinBlock?: (anchor: BlockAnchor) => void;
};

export function MarkdownView({ content, notes, documentPath, onPinBlock }: MarkdownViewProps) {
  const prepared = useMemo(() => preprocessReaderMarkdown(content), [content]);
  const plan = useMemo(() => createAnchorPlan(prepared), [prepared]);
  const notedBlockIds = useMemo(() => new Set(notes.map((note) => note.anchor.blockId)), [notes]);
  const resolveImageSrc = useMemo(
    () => createAssetResolver(getApiBase(), documentPath),
    [documentPath],
  );
  const inlinePlugins = useMemo(
    () => createReaderInlinePlugins(resolveImageSrc),
    [resolveImageSrc],
  );

  const components = useMemo(
    () => createPinComponents({ onPinBlock, plan, notedBlockIds, resolveImageSrc }),
    [notedBlockIds, onPinBlock, plan, resolveImageSrc],
  );

  // MUST run at the start of every render pass so cursors restart in sync
  // with the actual Markdown render, regardless of whether `components`
  // was recreated (fixes re-render cursor exhaustion).
  plan.begin();

  return (
    <ReaderArticle>
      <Markdown
        key={content}
        className="reader-flow"
        contentWidth={680}
        autolink="gfm"
        components={components}
        inlinePlugins={inlinePlugins}
      >
        {prepared}
      </Markdown>
    </ReaderArticle>
  );
}
