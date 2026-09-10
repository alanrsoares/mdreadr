/**
 * The Inline Edit session: which block a reader has open in the inline editor,
 * which Sub-block of it, where focus goes when it closes, and what happens when
 * a second one is asked for while the first still holds unsaved text.
 *
 * Pure on purpose. Every one of these decisions used to live in `MarkdownView`
 * as `useState` plus two refs, which put them out of reach of `bun test` — the
 * repo has no DOM runner. The component now renders the outcome and decides
 * nothing.
 */

import { type SubBlockTarget, sameSubBlockTarget } from "@mdreadr/domain";
import { match } from "@onrails/pattern";
import { err, ok, type Result } from "@onrails/result";

/** The one open inline editor. */
export type InlineEdit = {
  blockId: string;
  /** `null` when the whole block is open rather than one Sub-block of it. */
  target: SubBlockTarget | null;
  /**
   * Where the block sat in document order when the editor took its place.
   * Captured at open because applying the edit gives the block a new
   * content-derived id, and focus still has to find its way back to it.
   */
  returnIndex: number;
};

/** No editor open, or the one that is. At most one: its text is the only copy. */
export type InlineEditState = InlineEdit | null;

/**
 * What the reader currently has open. `isDirty` sits alongside the state rather
 * than inside it because it changes on every keystroke, and folding it in would
 * re-render the whole rendered Document as the reader types.
 */
export type InlineEditStatus = {
  open: InlineEditState;
  isDirty: boolean;
};

/** Why an Inline Edit could not open. */
export type InlineEditRefusal = {
  /** Another editor is open holding text nothing else has a copy of. */
  _tag: "DirtyEditorOpen";
};

/** Why an Inline Edit could not be applied to the Draft. */
export type BlockEditError =
  /** The Tab has no Document on disk to edit (an unsaved drop). */
  | { _tag: "NoDocument" }
  /** The anchored block is no longer where its Anchor says it is. */
  | { _tag: "BlockNotFound" };

/** The empty session: nothing open, nothing to lose. */
export const noInlineEdit: InlineEditStatus = { open: null, isDirty: false };

/**
 * Whether `request` names the editor already open. A second gesture on the part
 * that is open is the same editor, not a competing one — and a *different* part
 * of the same block is a different editor, because opening it replaces the one
 * holding the reader's text.
 */
export const isSameInlineEdit = (
  open: InlineEditState,
  request: Pick<InlineEdit, "blockId" | "target">,
): boolean =>
  open !== null &&
  open.blockId === request.blockId &&
  sameSubBlockTarget(open.target, request.target);

/**
 * Opens an Inline Edit, unless doing so would silently discard a dirty editor's
 * text. Re-opening the editor already open is allowed and idempotent.
 */
export function openInlineEdit(
  current: InlineEditStatus,
  request: InlineEdit,
): Result<InlineEdit, InlineEditRefusal> {
  if (current.open === null) return ok(request);
  if (isSameInlineEdit(current.open, request)) {
    // The block is off screen while its own editor stands in for it, so the
    // caller's fresh index read cannot have found it. Keep the one captured
    // when the editor first opened, which is where focus still has to land.
    return ok({ ...request, returnIndex: current.open.returnIndex });
  }
  return current.isDirty ? err({ _tag: "DirtyEditorOpen" }) : ok(request);
}

/** Which Sub-block of `blockId` is open, if that block is the open one at all. */
export const openTargetIn = (open: InlineEditState, blockId: string): SubBlockTarget | undefined =>
  open?.blockId === blockId ? (open.target ?? undefined) : undefined;

/**
 * What the inline editor tells the reader when an edit will not apply. Phrased
 * for someone who has text in the editor and nowhere else, so every message
 * ends with what to do about it.
 */
export const blockEditErrorMessage = (error: BlockEditError): string =>
  match(error._tag)
    .with(
      "NoDocument",
      () => "This tab has no document on disk yet. Save it first, then apply this edit.",
    )
    .with(
      "BlockNotFound",
      () => "That block is no longer in the document. Copy your text before closing this editor.",
    )
    .exhaustive();
