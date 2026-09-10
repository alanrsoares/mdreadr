/**
 * The seam between the Tab that owns the Draft and the inline editor buried
 * inside the rendered Document.
 *
 * Applying an Inline Edit used to travel as a prop through every layer between
 * the two — `ReaderTab` to `DocumentView` to `MarkdownView` to the markdown
 * component factory to `InlineBlockEditor` — declared afresh at each hop, with
 * only the two ends ever reading it. Two of the middle hops answered an absent
 * handler with `BlockNotFound`, telling the reader their block had vanished
 * when nothing had ever been wired.
 *
 * Read from context, it is one declaration and no pass-through, and the
 * refusals left in `BlockEditError` are only ones a reader can actually reach.
 */

import { createContext, useContext } from "react";
import type { WithChildren } from "../types.ts";
import type { ApplyInlineEdit } from "./inline-edit.ts";

const ApplyInlineEditContext = createContext<ApplyInlineEdit | null>(null);

type ApplyInlineEditProviderProps = WithChildren & {
  apply: ApplyInlineEdit;
};

/** Offers the Tab's Draft to whatever inline editor opens beneath it. */
export const ApplyInlineEditProvider = ({ apply, children }: ApplyInlineEditProviderProps) => (
  <ApplyInlineEditContext.Provider value={apply}>{children}</ApplyInlineEditContext.Provider>
);

/**
 * How an inline editor reaches the Draft. Throws without a provider rather
 * than handing back a refusal: a rendered Document with no Draft behind it is
 * a wiring mistake, not something to explain to a reader holding text the app
 * has no other copy of.
 */
export function useApplyInlineEdit(): ApplyInlineEdit {
  const apply = useContext(ApplyInlineEditContext);
  if (apply === null) {
    throw new Error("useApplyInlineEdit: no ApplyInlineEditProvider above this Document");
  }
  return apply;
}
