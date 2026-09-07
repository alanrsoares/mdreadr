import type { RefObject } from "react";
import { useEffect } from "react";

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

const isHeading = (block: HTMLElement): boolean => HEADING_TAGS.has(block.tagName);

/** True for anything that owns its own keystrokes — CodeMirror, inputs, the
 *  inline block editor. `j` there is a letter, not a command. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest(".cm-editor")) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** The block the cursor moves from: the focused one if there is one, otherwise
 *  the first block at or below the top of the viewport, so `j` continues from
 *  wherever the reader has scrolled to. */
function currentIndex(blocks: HTMLElement[], root: HTMLElement): number {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    const focused = active.closest("[data-block-id]");
    if (focused instanceof HTMLElement) {
      const index = blocks.indexOf(focused);
      if (index !== -1) return index;
    }
  }

  const top = root.getBoundingClientRect().top;
  const firstVisible = blocks.findIndex((block) => block.getBoundingClientRect().bottom > top);
  return firstVisible === -1 ? blocks.length - 1 : firstVisible - 1;
}

function nextIndex(blocks: HTMLElement[], from: number, step: number, headingsOnly: boolean) {
  for (let i = from + step; i >= 0 && i < blocks.length; i += step) {
    const block = blocks[i];
    if (block && (!headingsOnly || isHeading(block))) return i;
  }
  return -1;
}

function moveTo(block: HTMLElement) {
  // Blocks are not in the tab order — the cursor is driven by j/k only — but
  // they have to be focusable for the focus ring and, through
  // `.group/pin:focus-within`, for the hover-only gutter controls.
  block.tabIndex = -1;
  block.focus({ preventScroll: true });
  block.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * `j` / `k` move the cursor block to block, `J` / `K` to the next or previous
 * heading. Bound on the document rather than on the reader root, because the
 * reader is not focused until the cursor exists; `enabled` and the text-entry
 * guard are what keep it out of Edit mode's way.
 */
export function useReaderBlockNavigation(
  rootRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTextEntry(event.target)) return;

      const step = event.key === "j" || event.key === "J" ? 1 : -1;
      if (!["j", "k", "J", "K"].includes(event.key)) return;

      const root = rootRef.current;
      if (!root) return;

      const blocks = [...root.querySelectorAll<HTMLElement>("[data-block-id]")];
      if (blocks.length === 0) return;

      const target = blocks[nextIndex(blocks, currentIndex(blocks, root), step, event.shiftKey)];
      if (!target) return;

      event.preventDefault();
      moveTo(target);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, rootRef]);
}
