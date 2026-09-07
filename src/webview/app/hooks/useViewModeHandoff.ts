import type { EditorView } from "@codemirror/view";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { DocumentViewMode } from "../components/DocumentViewModeSwitch.tsx";
import { scrollEditorToSettled } from "../session/editor-scroll.ts";
import { findScrollParent, foldY } from "../session/reader-geometry.ts";
import type { Landmark } from "../session/view-mode-continuity.ts";
import {
  offsetAtPixel,
  offsetForBlockId,
  pixelAtOffset,
  usableLandmarks,
} from "../session/view-mode-continuity.ts";

/** Frames to wait for the incoming view to mount before giving up. */
const MOUNT_FRAMES = 12;

/**
 * Every rendered block whose source offset can be resolved, as a pixel/offset
 * pair. Coverage is what decides accuracy: inside one landmark the map is
 * linear, so a screen-tall block can land the toggle a few lines out.
 */
function readerLandmarks(root: HTMLElement, content: string): Landmark[] {
  const landmarks: Landmark[] = [];

  for (const block of root.querySelectorAll<HTMLElement>("[data-block-id]")) {
    const blockId = block.dataset.blockId;
    if (!blockId) continue;
    const offset = offsetForBlockId(content, blockId);
    if (offset === undefined) continue;
    landmarks.push({ top: block.getBoundingClientRect().top, offset });
  }

  return usableLandmarks(landmarks);
}

/** The source offset at the fold in the editor, falling back to the cursor when
 *  the coordinate misses (empty document, mid-relayout). */
function offsetAtFold(view: EditorView, root: HTMLElement): number {
  const rect = view.dom.getBoundingClientRect();
  const position = view.posAtCoords({ x: rect.left + 8, y: foldY(root) + 2 });
  return position ?? view.state.selection.main.head;
}

function onNextMount(attempt: number, run: () => boolean): void {
  if (attempt > MOUNT_FRAMES) return;
  requestAnimationFrame(() => {
    if (!run()) onNextMount(attempt + 1, run);
  });
}

type ViewModeHandoff = {
  viewMode: DocumentViewMode;
  /** The markdown both modes are showing: the draft, not the saved file. */
  content: string;
  rootRef: RefObject<HTMLElement | null>;
  editorViewRef: RefObject<EditorView | null>;
  onChange: (mode: DocumentViewMode) => void;
};

/**
 * Carries the reading position across a Preview <-> Edit toggle: what sat at the
 * top of the reader sits at the top of the editor, and back.
 *
 * The position has to be read *before* the mode changes, because the outgoing
 * view unmounts, so this returns a wrapped `onViewModeChange` for the switch to
 * call rather than watching the mode on its own.
 */
export function useViewModeHandoff({
  viewMode,
  content,
  rootRef,
  editorViewRef,
  onChange,
}: ViewModeHandoff): (mode: DocumentViewMode) => void {
  const pendingRef = useRef<number | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const changeViewMode = useCallback(
    (next: DocumentViewMode) => {
      const root = rootRef.current;
      if (!root || next === viewMode) {
        onChange(next);
        return;
      }

      if (next === "edit") {
        const landmarks = readerLandmarks(root, contentRef.current);
        pendingRef.current = offsetAtPixel(landmarks, foldY(root)) ?? null;
      } else {
        const view = editorViewRef.current;
        pendingRef.current = view ? offsetAtFold(view, root) : null;
      }

      onChange(next);
    },
    [editorViewRef, onChange, rootRef, viewMode],
  );

  useEffect(() => {
    const offset = pendingRef.current;
    pendingRef.current = null;
    if (offset === null) return;

    if (viewMode === "edit") {
      onNextMount(0, () => {
        const view = editorViewRef.current;
        const root = rootRef.current;
        if (!view || !root) return false;

        const position = Math.min(offset, view.state.doc.length);
        view.dispatch({ selection: { anchor: position } });
        return scrollEditorToSettled(view, root, position);
      });
      return;
    }

    onNextMount(0, () => {
      const root = rootRef.current;
      if (!root) return false;
      const landmarks = readerLandmarks(root, contentRef.current);
      const target = pixelAtOffset(landmarks, offset);
      if (target === undefined) return false;

      const scroller = findScrollParent(root.querySelector<HTMLElement>("[data-block-id]") ?? root);
      if (!scroller) return false;
      scroller.scrollTop += target - foldY(root);
      return true;
    });
  }, [editorViewRef, rootRef, viewMode]);

  return changeViewMode;
}
