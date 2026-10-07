import { spliceMarkdown } from "./splice.ts";

/**
 * What Write mode remembers between edits: the Draft it last handed back, and
 * the markdown the editor exported for it. An edit is the difference between
 * that export and the editor's current one, applied to that Draft.
 */
export type WriteSync = {
  readonly markdown: string;
  readonly exported: string;
};

/** Starts tracking: the Draft text paired with what the editor exported for it. */
export const startWriteSync = (markdown: string, exported: string): WriteSync => ({
  markdown,
  exported,
});

export type WriteEdit = {
  sync: WriteSync;
  /** True when the Draft text actually differs, so selection-only updates stay quiet. */
  changed: boolean;
};

/** Splices an editor export into the Draft, touching only the blocks that changed. */
export function applyWriteEdit(sync: WriteSync, exported: string): WriteEdit {
  const markdown = spliceMarkdown(sync.markdown, sync.exported, exported);
  return { sync: { markdown, exported }, changed: markdown !== sync.markdown };
}

/**
 * The Drafts Write mode handed back that the parent has not yet echoed to it
 * as `value`. Edits can outrun renders, so the parent may show an older one of
 * them than the newest; each is still the editor's own, not a change from
 * outside.
 */
export type PendingEmits = readonly string[];

export type DraftArrival = {
  /** True when `value` did not come from this editor. */
  external: boolean;
  pending: PendingEmits;
};

/** Classifies the Draft the parent now shows, dropping the emits it has caught up with. */
export function receiveDraft(pending: PendingEmits, value: string): DraftArrival {
  const index = pending.lastIndexOf(value);
  return index === -1
    ? { external: true, pending: [] }
    : { external: false, pending: pending.slice(index + 1) };
}
