export type DraftState = {
  /** Path the Draft belongs to; a Draft never survives a Document switch. */
  path: string | null;
  /** null = no edits since open/save. */
  text: string | null;
};

export const emptyDraft: DraftState = { path: null, text: null };

/** Record an edit to the Draft for `path`. Typing back the saved content un-dirties it. */
export const editDraft = (path: string, text: string, savedContent: string): DraftState =>
  text === savedContent ? { path, text: null } : { path, text };

/** True only when the Draft belongs to `path` and has unsaved edits. */
export const isDirty = (state: DraftState, path: string | undefined): boolean =>
  state.path === path && state.text !== null;

/** Discard the Draft entirely. */
export const discardDraft = (_state: DraftState): DraftState => emptyDraft;

/** Mark the Draft as saved: keep its path, clear its edits. */
export const draftSaved = (state: DraftState): DraftState => ({ path: state.path, text: null });
