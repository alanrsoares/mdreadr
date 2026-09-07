import { match } from "@onrails/pattern";

/** Why an inline block edit could not be applied to the Draft. */
export type BlockEditError =
  /** The Tab has no Document on disk to edit (an unsaved drop). */
  | { _tag: "NoDocument" }
  /** The anchored block is no longer where its Anchor says it is. */
  | { _tag: "BlockNotFound" };

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
