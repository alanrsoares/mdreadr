import { parseMarkdown } from "@astryxdesign/core/Markdown/utils";
import {
  type BlockAnchor,
  blockIdForCode,
  blockIdForHeading,
  blockIdForParagraph,
  collectPinnableBlocks,
  extractHeadings,
  hashBlockContent,
  headingPathForLevel,
  type TocEntry,
  truncateAnchorLabel,
} from "@mdreadr/domain";
import { isSpecialFence } from "./pipeline.tsx";

export type AnchorPlan = {
  /** Headings of the *prepared* markdown, in order (drives heading ids). */
  headings: TocEntry[];
  /** Reset render cursors. MUST be called at the start of every render pass. */
  begin(): void;
  /** Next heading: anchor + the DOM id to stamp (id === anchor.blockId). */
  nextHeading(level: number, text: string): { anchor: BlockAnchor; domId: string };
  nextParagraph(text: string): BlockAnchor;
  nextCode(code: string, language?: string): BlockAnchor;
};

const isPinnableCodeBlock = (language: string | undefined): boolean => !isSpecialFence(language);

/** Build the Anchor plan for a Document's *prepared* markdown (post-preprocess). */
export function createAnchorPlan(prepared: string): AnchorPlan {
  const headings = extractHeadings(prepared);

  const blocks = parseMarkdown(prepared, { autolink: "gfm" });
  const pinnable = collectPinnableBlocks(blocks, isPinnableCodeBlock);

  const paragraphCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  const paragraphIds: string[] = [];
  const codeIds: string[] = [];

  for (const block of pinnable) {
    if (block.kind === "paragraph") {
      const hash = hashBlockContent(block.text);
      const occurrence = paragraphCounts.get(hash) ?? 0;
      paragraphCounts.set(hash, occurrence + 1);
      paragraphIds.push(blockIdForParagraph(block.text, occurrence));
      continue;
    }

    const key = hashBlockContent(`${block.language ?? ""}\n${block.text}`);
    const occurrence = codeCounts.get(key) ?? 0;
    codeCounts.set(key, occurrence + 1);
    codeIds.push(blockIdForCode(block.text, block.language, occurrence));
  }

  let paragraphIndex = 0;
  let codeIndex = 0;
  let headingIndex = 0;
  let headingStack: { level: number; text: string }[] = [];

  return {
    headings,
    begin() {
      paragraphIndex = 0;
      codeIndex = 0;
      headingIndex = 0;
      headingStack = [];
    },
    nextHeading(level, text) {
      const { stack, path: headingPath } = headingPathForLevel(headingStack, level, text);
      headingStack = stack;
      const entry = headings[headingIndex];
      headingIndex += 1;
      const blockId = entry ? blockIdForHeading(entry) : `heading-${headingIndex}`;

      return {
        anchor: { kind: "heading", blockId, headingPath, label: truncateAnchorLabel(text) },
        domId: blockId,
      };
    },
    nextParagraph(text) {
      const id = paragraphIds[paragraphIndex];
      paragraphIndex += 1;
      return {
        kind: "paragraph",
        blockId: id ?? blockIdForParagraph(text, 0),
        label: truncateAnchorLabel(text),
      };
    },
    nextCode(code, language) {
      const id = codeIds[codeIndex];
      codeIndex += 1;
      return {
        kind: "code",
        blockId: id ?? blockIdForCode(code, language, 0),
        label: truncateAnchorLabel(code.split("\n")[0] ?? code),
      };
    },
  };
}

export function flashAnchor(blockId: string, className = "reader-block-highlight"): boolean {
  const element = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`);
  if (!(element instanceof HTMLElement)) return false;
  element.classList.remove(className);
  // Force restart when re-pinning the same block.
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => {
    element.classList.remove(className);
  }, 1800);
  return true;
}

export function scrollToAnchor(blockId: string): boolean {
  const element = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`);
  if (!(element instanceof HTMLElement)) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  return flashAnchor(blockId);
}

export function anchorDisplayLabel(anchor: BlockAnchor): string {
  if (anchor.label?.trim()) return anchor.label.trim();
  if (anchor.headingPath?.length) return anchor.headingPath.join(" › ");
  return anchor.kind;
}
