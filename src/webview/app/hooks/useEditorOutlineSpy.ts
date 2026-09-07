import type { EditorView } from "@codemirror/view";
import type { TocEntry } from "@mdreadr/domain";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { outlineIdAtLine } from "../session/outline-position.ts";
import { findScrollParent, foldY } from "../session/reader-geometry.ts";

/** Source line at the fold. Taken off CodeMirror's height map rather than
 *  `posAtCoords`, which has nothing to say about lines it has not rendered.
 *  Probed a shade below the fold: a heading scrolled flush to the top otherwise
 *  resolves to the line above it, and the outline lags a section behind. */
function lineAtFold(view: EditorView, root: HTMLElement): number {
  const block = view.lineBlockAtHeight(foldY(root) + 2 - view.documentTop);
  return view.state.doc.lineAt(block.from).number - 1;
}

/**
 * The active outline entry while editing.
 *
 * `useOutlineScrollSpy` resolves headings by DOM id, and in Edit mode the
 * headings are text in a CodeMirror document, not elements - so the outline
 * would only ever highlight whatever was last clicked. The editor shares the
 * reader's scroll container, so the same scroll drives this.
 */
export function useEditorOutlineSpy(
  editorViewRef: RefObject<EditorView | null>,
  rootRef: RefObject<HTMLElement | null>,
  entries: readonly TocEntry[],
  enabled: boolean,
): string | undefined {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    if (!enabled) {
      setActiveId(undefined);
      return;
    }

    let frame = 0;
    let scroller: HTMLElement | null = null;

    const update = () => {
      frame = 0;
      const view = editorViewRef.current;
      const root = rootRef.current;
      if (!view || !root) return;
      const next = outlineIdAtLine(entriesRef.current, lineAtFold(view, root));
      setActiveId((current) => (current === next ? current : next));
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    // The editor mounts a frame or two after the mode flips, so the listener
    // waits for the view rather than for this effect.
    const attach = () => {
      const view = editorViewRef.current;
      if (!view) {
        frame = requestAnimationFrame(attach);
        return;
      }
      scroller = findScrollParent(view.dom);
      scroller?.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      update();
    };

    attach();

    return () => {
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [editorViewRef, enabled, rootRef]);

  return enabled ? activeId : undefined;
}
