import type { EditorView } from "@codemirror/view";
import { findScrollParent, foldY } from "./reader-geometry.ts";

/**
 * Scrolls the shared container so a source position sits at the fold.
 *
 * `EditorView.scrollIntoView` is not enough here: the editor shares the
 * reader's scroll container rather than owning one, so CodeMirror lands the
 * line somewhere in view rather than at the top, and `coordsAtPos` has nothing
 * to say about a line it has not rendered. The height map covers the whole
 * document, so ask that instead.
 */
export function scrollEditorTo(view: EditorView, root: HTMLElement, position: number): boolean {
  const scroller = findScrollParent(view.dom);
  if (!scroller) return false;
  scroller.scrollTop += view.documentTop + view.lineBlockAt(position).top - foldY(root);
  return true;
}

/**
 * As above, then once more on the next frame: heights are estimated for the
 * part of the document CodeMirror has not rendered yet, so the first scroll is
 * approximate and the second lands it.
 */
export function scrollEditorToSettled(
  view: EditorView,
  root: HTMLElement,
  position: number,
): boolean {
  if (!scrollEditorTo(view, root, position)) return false;
  requestAnimationFrame(() => scrollEditorTo(view, root, position));
  return true;
}
