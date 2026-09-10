import type { BlockAnchor } from "@mdreadr/domain";
import type { AnchorPlan } from "./anchors.ts";
import type { ImageSrcResolver } from "./pipeline.tsx";

/**
 * What rendering one Document needs, with nothing about editing it in here.
 * Read-only in the sense that matters: every field is something a block reads
 * to draw itself, so a change to the Inline Edit session cannot reach through
 * this and repaint the whole Document.
 *
 * It used to be seven inline-edit fields deep in the same bag as these four,
 * ten of the twelve optional, which left every block asking whether editing
 * was on offer. The session travels beside it now as an `InlineEditHandle`.
 */
export type RenderContext = {
  /** The Anchor Plan for this render pass, handing out ids in document order. */
  plan: AnchorPlan;
  /** Blocks that already carry a Note, so the margin can say so. */
  notedBlockIds: ReadonlySet<string>;
  /** The Document's prepared source, for the copy actions and editor seeding. */
  content: string;
  resolveImageSrc: ImageSrcResolver;
  /**
   * Anchors a Note to a block. The one honest optional: an unsaved drop has no
   * Document on disk for a Note to point at, so its blocks offer no pin.
   */
  onPinBlock?: (anchor: BlockAnchor) => void;
};
