/** DOM geometry both view modes share: where the document starts on screen, and
 *  which element actually scrolls it. */

/** The fold: the first line of the document a reader can actually see, i.e. the
 *  top of the scroll area once the sticky document chrome is discounted. */
export function foldY(root: HTMLElement): number {
  const body = root.querySelector(".reader-document-body");
  const chrome = body?.previousElementSibling;
  const chromeHeight = chrome instanceof HTMLElement ? chrome.getBoundingClientRect().height : 0;
  return root.getBoundingClientRect().top + chromeHeight;
}

/**
 * The scroll container a node lives in. Overflow has to be checked, not just
 * the height difference: a block wrapper can be a pixel taller than its box and
 * still not scroll.
 */
export function findScrollParent(from: HTMLElement): HTMLElement | null {
  let node = from.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    const scrolls = overflowY === "auto" || overflowY === "scroll";
    if (scrolls && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
}
