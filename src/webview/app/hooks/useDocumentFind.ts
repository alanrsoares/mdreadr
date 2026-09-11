import type { EditorView } from "@codemirror/view";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { DocumentViewMode } from "../components/DocumentViewModeSwitch.tsx";
import { clearHighlights, collectTextNodes, paintMatches } from "../markdown/find-highlight.ts";
import {
  type FindMatch,
  findMatches,
  matchNearestTo,
  stepMatch,
} from "../markdown/find-matches.ts";
import { scrollEditorToSettled } from "../session/editor-scroll.ts";
import { findScrollParent, foldY } from "../session/reader-geometry.ts";

export type DocumentFind = {
  isOpen: boolean;
  query: string;
  /** Which match the reader is on, 1-based for display. `0` when there are none. */
  position: number;
  total: number;
  open: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  step: (direction: 1 | -1) => void;
};

export type UseDocumentFindInput = {
  /** A parked tab keeps its find state but answers no shortcuts. */
  isActive: boolean;
  mode: DocumentViewMode;
  /** The rendered Document, searched in Preview. */
  previewRef: RefObject<HTMLElement | null>;
  /** The scroll container, for placing a source match at the fold. */
  rootRef: RefObject<HTMLElement | null>;
  editorViewRef: RefObject<EditorView | null>;
  /** Source text, searched in Edit. Changes as the reader types. */
  editorValue: string;
};

/**
 * Find within the open Document.
 *
 * One session across both modes: the same term, the same counter, and a match
 * index that survives the Preview/Edit toggle, because a reviewer who searched
 * in Preview and switched to Edit to fix what they found is still looking for
 * the same thing. What differs is only where the text comes from and how a
 * match is shown: painted ranges over the prose, a real selection in the source.
 */
export function useDocumentFind({
  isActive,
  mode,
  previewRef,
  rootRef,
  editorViewRef,
  editorValue,
}: UseDocumentFindInput): DocumentFind {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [index, setIndex] = useState(-1);
  // Where the reader was when the term last changed, so adding a letter keeps
  // them on the match they were reading instead of jumping to the top.
  const anchorRef = useRef(0);

  const close = useCallback(() => {
    setIsOpen(false);
    setMatches([]);
    setIndex(-1);
    clearHighlights();
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
  }, []);

  const step = useCallback((direction: 1 | -1) => {
    setIndex((current) => stepMatch(matchesRef.current.length, current, direction));
  }, []);

  // Read by `step`, which must not be re-created on every keystroke: the find
  // bar binds it to Enter, and a new identity per render would reset that.
  // Written after commit, not during render: a render React abandons must not
  // leave `step` counting matches nobody is looking at.
  const matchesRef = useRef<FindMatch[]>([]);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  // Collect the text and match against it. In Preview that means reading the
  // rendered DOM, so it runs after paint rather than during render.
  useEffect(() => {
    if (!isOpen) return;

    const haystack =
      mode === "edit"
        ? editorValue
        : collectTextNodes(previewRef.current ?? document.createElement("div"))
            .map((node) => node.data)
            .join("");

    const found = findMatches(haystack, query);
    setMatches(found);
    setIndex(matchNearestTo(found, anchorRef.current));
  }, [isOpen, query, mode, editorValue, previewRef]);

  // Show the match the reader is on: painted over the prose, selected in the
  // source. Separate from finding them, so stepping does not re-scan the text.
  useEffect(() => {
    // A parked Tab paints nothing: the highlight registry is the window's, so
    // painting from the background would draw this Document's matches over the
    // one in front. Reactivating repaints, which is why `isActive` is a dep.
    if (!isOpen || !isActive) return;
    const match = matches[index];
    if (match) anchorRef.current = match.start;

    if (mode === "edit") {
      clearHighlights();
      const view = editorViewRef.current;
      const root = rootRef.current;
      if (!view || !match) return;
      view.dispatch({ selection: { anchor: match.start, head: match.end } });
      if (root) scrollEditorToSettled(view, root, match.start);
      return;
    }

    const root = previewRef.current;
    if (!root) return;
    const { currentRange } = paintMatches(collectTextNodes(root), matches, index);
    if (currentRange) revealRange(currentRange, root);
  }, [isOpen, isActive, matches, index, mode, previewRef, rootRef, editorViewRef]);

  // Painted ranges belong to this tab's DOM: leaving the tab, or the Document,
  // must not leave them on the next one.
  useEffect(() => {
    if (isActive) return;
    clearHighlights();
  }, [isActive]);

  useEffect(() => clearHighlights, []);

  return {
    isOpen,
    query,
    position: index < 0 ? 0 : index + 1,
    total: matches.length,
    open,
    close,
    setQuery,
    step,
  };
}

/**
 * Scrolls a painted match into view, if it is not already.
 *
 * The Range's own rectangle, not its start element's: a match inside an inline
 * `<span>` (every styled run the markdown renderer emits) reports a zero box
 * on the element, which reads as "already on screen" and scrolls nowhere. A
 * match that is visible is left alone, so stepping within one paragraph does
 * not re-centre the page on every press.
 */
function revealRange(range: Range, root: HTMLElement): void {
  const scroller = findScrollParent(root) ?? root;
  const view = scroller.getBoundingClientRect();
  const rect = range.getBoundingClientRect();
  const fold = foldY(scroller);

  const isVisible = rect.top >= fold && rect.bottom <= view.bottom;
  if (isVisible) return;

  const centred = rect.top - view.top - (scroller.clientHeight - rect.height) / 2;
  scroller.scrollTo({ top: scroller.scrollTop + centred, behavior: "smooth" });
}
