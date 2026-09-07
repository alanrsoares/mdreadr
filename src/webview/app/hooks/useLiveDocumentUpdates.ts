import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { collectBlockIds, flashAnchor } from "../markdown/anchors.ts";
import { preprocessReaderMarkdown } from "../markdown/pipeline.tsx";

/** The class `index.css` animates for a block that changed on disk. */
const UPDATED_CLASS = "reader-block-updated";

/**
 * Past this the flash stops reading as "here is what the agent touched" and
 * starts reading as the whole page blinking, so a wholesale rewrite gets none.
 */
const MAX_FLASHED_BLOCKS = 12;

type Snapshot = { content: string; ids: Set<string> };

/**
 * Makes an on-disk change to an open Document land gently: the reader keeps its
 * scroll position across the re-render, and the blocks whose text actually
 * changed flash once so the human can see what the agent did without diffing by
 * eye.
 *
 * `enabled` is false in edit mode, where there is no rendered preview to flash —
 * the snapshot still advances there, so switching back to preview doesn't
 * replay every edit made in between as if it had just arrived.
 */
export function useLiveDocumentUpdates(
  content: string,
  scrollRootRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  const snapshotRef = useRef<Snapshot | null>(null);
  const scrollTopRef = useRef(0);

  // Scroll position comes from a listener rather than being read inside the
  // content effect: by then MarkdownView has remounted its subtree (it is keyed
  // on content) and the browser has already clamped scrollTop against the
  // momentarily empty document.
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    const onScroll = () => {
      scrollTopRef.current = root.scrollTop;
    };

    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRootRef]);

  useLayoutEffect(() => {
    const previous = snapshotRef.current;
    const ids = collectBlockIds(preprocessReaderMarkdown(content));
    snapshotRef.current = { content, ids };

    if (!enabled || !previous || previous.content === content) return;

    const root = scrollRootRef.current;
    if (root) {
      const target = scrollTopRef.current;
      root.scrollTop = target;
      // Diagrams, math and images size themselves a frame or two after mount,
      // so a single restore lands short on Documents that contain them.
      requestAnimationFrame(() => {
        if (root.scrollTop !== target) root.scrollTop = target;
      });
    }

    const changed = [...ids].filter((id) => !previous.ids.has(id));
    if (changed.length === 0 || changed.length > MAX_FLASHED_BLOCKS) return;

    // One frame later the remounted blocks carry their `data-block-id`.
    requestAnimationFrame(() => {
      for (const id of changed) flashAnchor(id, UPDATED_CLASS);
    });
  }, [content, enabled, scrollRootRef]);
}
