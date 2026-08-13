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
import { useFontSettings } from "../theme/FontSettingsContext.tsx";
import { getApiBase } from "../treaty.ts";
import { ReaderArticle } from "../ui/reader.tsx";

/** 680px at the 17px default — kept as a ratio so the measure stays ~constant
 *  in characters as the reader font size changes. */
const MEASURE_EMS = 40;

type MarkdownViewProps = {
  content: string;
  notes: Note[];
  documentPath?: string;
  onPinBlock?: (anchor: BlockAnchor) => void;
};

export function MarkdownView({ content, notes, documentPath, onPinBlock }: MarkdownViewProps) {
  const { readerFontSize } = useFontSettings();
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
        contentWidth={Math.round(readerFontSize * MEASURE_EMS)}
        autolink="gfm"
        components={components}
        inlinePlugins={inlinePlugins}
      >
        {prepared}
      </Markdown>
    </ReaderArticle>
  );
}
