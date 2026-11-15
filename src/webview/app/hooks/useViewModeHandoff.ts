import type { EditorView } from "@codemirror/view";
import { match } from "@onrails/pattern";
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
import { writeBlockIndexAtOffset, writeLandmarks } from "../write/handoff.ts";

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

/** The Write surface's top-level elements: one per source block. */
function writeElements(root: HTMLElement): HTMLElement[] {
  const surface = root.querySelector<HTMLElement>('[contenteditable="true"]');
  return surface ? Array.from(surface.children).filter((el) => el instanceof HTMLElement) : [];
}

/** An empty line the reader added: a paragraph with no text and nothing embedded. */
const isBlankParagraph = (element: HTMLElement): boolean =>
  element.tagName === "P" && element.textContent?.trim() === "" && !element.querySelector("img");

function writeLandmarksOf(root: HTMLElement, content: string): Landmark[] {
  const elements = writeElements(root).map((element) => ({
    top: element.getBoundingClientRect().top,
    empty: isBlankParagraph(element),
  }));
  return writeLandmarks(elements, content);
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
  /** The column holding the Write surface; read for its elements, never written. */
  writeRootRef: RefObject<HTMLElement | null>;
  onChange: (mode: DocumentViewMode) => void;
};

/**
 * Carries the reading position across a toggle between Preview, Write and Edit:
 * what sat at the top of the outgoing view sits at the top of the incoming one.
 * Entering Write also puts the caret at the start of that block and focuses it,
 * so the reader can type where they were looking.
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
  writeRootRef,
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

      pendingRef.current =
        match(viewMode)
          .with("preview", () =>
            offsetAtPixel(readerLandmarks(root, contentRef.current), foldY(root)),
          )
          .with("write", () => {
            const writeRoot = writeRootRef.current ?? root;
            return offsetAtPixel(writeLandmarksOf(writeRoot, contentRef.current), foldY(root));
          })
          .with("edit", () => {
            const view = editorViewRef.current;
            return view ? offsetAtFold(view, root) : undefined;
          })
          .exhaustive() ?? null;

      onChange(next);
    },
    [editorViewRef, onChange, rootRef, viewMode, writeRootRef],
  );

  useEffect(() => {
    const offset = pendingRef.current;
    pendingRef.current = null;
    if (offset === null) return;

    match(viewMode)
      .with("edit", () =>
        onNextMount(0, () => {
          const view = editorViewRef.current;
          const root = rootRef.current;
          if (!view || !root) return false;

          const position = Math.min(offset, view.state.doc.length);
          view.dispatch({ selection: { anchor: position } });
          return scrollEditorToSettled(view, root, position);
        }),
      )
      .with("write", () =>
        onNextMount(0, () => {
          const root = rootRef.current;
          const writeRoot = writeRootRef.current;
          if (!root || !writeRoot) return false;

          const elements = writeElements(writeRoot);
          const target = pixelAtOffset(writeLandmarksOf(writeRoot, contentRef.current), offset);
          const scroller = findScrollParent(elements[0] ?? writeRoot);
          if (target === undefined || !scroller) return false;
          scroller.scrollTop += target - foldY(root);

          // Caret at the start of the block the reader was on.
          const index = writeBlockIndexAtOffset(
            contentRef.current,
            offset,
            elements.map(isBlankParagraph),
          );
          const element = index === undefined ? undefined : elements[index];
          const surface = writeRoot.querySelector<HTMLElement>('[contenteditable="true"]');
          if (element && surface) {
            surface.focus({ preventScroll: true });
            const range = document.createRange();
            range.setStart(element, 0);
            range.collapse(true);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
          return true;
        }),
      )
      .with("preview", () =>
        onNextMount(0, () => {
          const root = rootRef.current;
          if (!root) return false;
          const landmarks = readerLandmarks(root, contentRef.current);
          const target = pixelAtOffset(landmarks, offset);
          if (target === undefined) return false;

          const scroller = findScrollParent(
            root.querySelector<HTMLElement>("[data-block-id]") ?? root,
          );
          if (!scroller) return false;
          scroller.scrollTop += target - foldY(root);
          return true;
        }),
      )
      .exhaustive();
  }, [editorViewRef, rootRef, viewMode, writeRootRef]);

  return changeViewMode;
}
