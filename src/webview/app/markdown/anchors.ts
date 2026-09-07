import { parseMarkdown } from "@astryxdesign/core/Markdown/utils";
import {
  type BlockAnchor,
  blockIdForCode,
  blockIdForHeading,
  blockIdForList,
  blockIdForParagraph,
  blockIdForTable,
  collectPinnableBlocks,
  extractHeadings,
  hashBlockContent,
  headingPathForLevel,
  listToText,
  type TocEntry,
  tableToText,
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
  nextList(text: string): BlockAnchor;
  nextTable(text: string): BlockAnchor;
};

const isPinnableCodeBlock = (language: string | undefined): boolean => !isSpecialFence(language);

type BlockIds = {
  headings: TocEntry[];
  paragraphIds: string[];
  codeIds: string[];
  listIds: string[];
  tableIds: string[];
};

/** The ids `createAnchorPlan` will hand out, in render order, without the cursor state. */
function computeBlockIds(prepared: string): BlockIds {
  const headings = extractHeadings(prepared);

  const blocks = parseMarkdown(prepared, { autolink: "gfm" });
  const pinnable = collectPinnableBlocks(blocks, isPinnableCodeBlock);

  const paragraphCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  const listCounts = new Map<string, number>();
  const tableCounts = new Map<string, number>();
  const paragraphIds: string[] = [];
  const codeIds: string[] = [];
  const listIds: string[] = [];
  const tableIds: string[] = [];

  for (const block of pinnable) {
    if (block.kind === "paragraph") {
      const hash = hashBlockContent(block.text);
      const occurrence = paragraphCounts.get(hash) ?? 0;
      paragraphCounts.set(hash, occurrence + 1);
      paragraphIds.push(blockIdForParagraph(block.text, occurrence));
      continue;
    }

    if (block.kind === "code") {
      const key = hashBlockContent(`${block.language ?? ""}\n${block.text}`);
      const occurrence = codeCounts.get(key) ?? 0;
      codeCounts.set(key, occurrence + 1);
      codeIds.push(blockIdForCode(block.text, block.language, occurrence));
      continue;
    }

    if (block.kind === "list") {
      const hash = hashBlockContent(block.text);
      const occurrence = listCounts.get(hash) ?? 0;
      listCounts.set(hash, occurrence + 1);
      listIds.push(blockIdForList(block.text, occurrence));
      continue;
    }

    if (block.kind === "table") {
      const hash = hashBlockContent(block.text);
      const occurrence = tableCounts.get(hash) ?? 0;
      tableCounts.set(hash, occurrence + 1);
      tableIds.push(blockIdForTable(block.text, occurrence));
    }
  }

  return { headings, paragraphIds, codeIds, listIds, tableIds };
}

/**
 * Every anchorable block id in `prepared`. Paragraph and code ids hash their own
 * content, so diffing this set across two revisions of a Document yields exactly
 * the blocks whose text changed — what `useLiveDocumentUpdates` flashes when a
 * file is rewritten under the reader.
 */
export function collectBlockIds(prepared: string): Set<string> {
  const { headings, paragraphIds, codeIds, listIds, tableIds } = computeBlockIds(prepared);
  return new Set([
    ...headings.map(blockIdForHeading),
    ...paragraphIds,
    ...codeIds,
    ...listIds,
    ...tableIds,
  ]);
}

/** Build the Anchor plan for a Document's *prepared* markdown (post-preprocess). */
export function createAnchorPlan(prepared: string): AnchorPlan {
  const { headings, paragraphIds, codeIds, listIds, tableIds } = computeBlockIds(prepared);

  let paragraphIndex = 0;
  let codeIndex = 0;
  let listIndex = 0;
  let tableIndex = 0;
  let headingIndex = 0;
  let headingStack: { level: number; text: string }[] = [];

  return {
    headings,
    begin() {
      paragraphIndex = 0;
      codeIndex = 0;
      listIndex = 0;
      tableIndex = 0;
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
    nextList(text) {
      const id = listIds[listIndex];
      listIndex += 1;
      return {
        kind: "list",
        blockId: id ?? blockIdForList(text, 0),
        label: truncateAnchorLabel(text),
      };
    },
    nextTable(text) {
      const id = tableIds[tableIndex];
      tableIndex += 1;
      return {
        kind: "table",
        blockId: id ?? blockIdForTable(text, 0),
        label: truncateAnchorLabel(text),
      };
    },
  };
}

export type ReaderSegment =
  | { kind: "markdown"; text: string; key: string }
  | {
      kind: "list";
      text: string;
      rawText: string;
      key: string;
    }
  | {
      kind: "table";
      text: string;
      rawText: string;
      key: string;
    };

export function partitionReaderSegments(prepared: string): ReaderSegment[] {
  const blocks = parseMarkdown(prepared, { sourceRanges: true, autolink: "gfm" });
  const segments: ReaderSegment[] = [];
  let cursor = 0;
  let index = 0;

  for (const block of blocks) {
    if (block.type === "list" || block.type === "table") {
      if (block.range && block.range.start > cursor) {
        const slice = prepared.slice(cursor, block.range.start);
        if (slice.trim()) {
          segments.push({
            kind: "markdown",
            text: slice.trim(),
            key: `md-${index++}`,
          });
        }
      }
      if (block.range) {
        const raw = prepared.slice(block.range.start, block.range.end);
        if (block.type === "list") {
          segments.push({
            kind: "list",
            text: raw,
            rawText: listToText(block),
            key: `list-${index++}`,
          });
        } else {
          segments.push({
            kind: "table",
            text: raw,
            rawText: tableToText(block),
            key: `table-${index++}`,
          });
        }
        cursor = block.range.end;
      }
    }
  }

  if (cursor < prepared.length) {
    const remaining = prepared.slice(cursor);
    if (remaining.trim()) {
      segments.push({
        kind: "markdown",
        text: remaining.trim(),
        key: `md-${index++}`,
      });
    }
  }

  if (segments.length === 0) {
    segments.push({ kind: "markdown", text: prepared, key: "md-0" });
  }

  return segments;
}

function flashElement(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  // Force restart when re-pinning the same block.
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => {
    element.classList.remove(className);
  }, 1800);
}

export function flashAnchor(blockId: string, className = "reader-block-highlight"): boolean {
  const element = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`);
  if (!(element instanceof HTMLElement)) return false;
  flashElement(element, className);
  return true;
}

/** Every anchored block in the document, in document order. */
const blockElements = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-block-id]"));

/** Where a block sits in document order, or `-1`. */
export const indexOfBlock = (blockId: string): number =>
  blockElements().findIndex((element) => element.dataset.blockId === blockId);

/**
 * Focuses, and optionally flashes, the block at `index` in document order.
 *
 * Position, not id: paragraph and heading ids are derived from their own
 * content, so a block that was just edited comes back with a *different* id,
 * and anything looking for the old one silently finds nothing. Its place in the
 * document is the handle that survives the edit. Focus rather than scroll, so
 * the `j`/`k` cursor and the hover-only gutter controls stay reachable from the
 * keyboard once the editor closes.
 */
export function focusBlockAtIndex(index: number, className?: string): boolean {
  const element = blockElements()[index];
  if (!element) return false;
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
  if (className) flashElement(element, className);
  return true;
}

/** Selector for the open inline block editor, used by callers that need to
 *  know an edit is in progress without owning that state. */
export const INLINE_EDITOR_SELECTOR = ".reader-block-edit";

/**
 * Pulses the open inline editor and puts the caret back in it. Used when a
 * gesture elsewhere would have discarded an edit in progress: the editor
 * answers the click instead of the text disappearing.
 */
export function callAttentionToInlineEditor(): boolean {
  const editor = document.querySelector(INLINE_EDITOR_SELECTOR);
  if (!(editor instanceof HTMLElement)) return false;

  const className = "reader-block-edit-attention";
  editor.classList.remove(className);
  // Force restart when the same editor is nudged twice.
  void editor.offsetWidth;
  editor.classList.add(className);
  editor.addEventListener(
    "animationend",
    () => {
      editor.classList.remove(className);
    },
    { once: true },
  );

  editor.querySelector("textarea")?.focus({ preventScroll: true });
  editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return true;
}

export function scrollToAnchor(blockId: string): boolean {
  const element = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`);
  if (!(element instanceof HTMLElement)) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  return flashAnchor(blockId);
}

/**
 * Scrolls to the heading a `#slug` link points at. Markdown fragments are
 * GitHub-style slugs (`#hard-bans`) while the reader's own heading ids carry a
 * `heading-` prefix (`blockIdForHeading`), so both spellings are tried.
 */
export function scrollToHeadingSlug(slug: string): boolean {
  return scrollToAnchor(`heading-${slug}`) || scrollToAnchor(slug);
}

export function anchorDisplayLabel(anchor: BlockAnchor): string {
  if (anchor.label?.trim()) return anchor.label.trim();
  if (anchor.headingPath?.length) return anchor.headingPath.join(" › ");
  return anchor.kind;
}
