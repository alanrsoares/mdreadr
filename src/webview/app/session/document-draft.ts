export type DraftState = {
  /** Path the Draft belongs to; a Draft never survives a Document switch. */
  path: string | null;
  /** null = no edits since open/save. */
  text: string | null;
};

export const emptyDraft: DraftState = { path: null, text: null };

/** Record an edit to the Draft for `path`. Typing back the saved content un-dirties it. */
export function editDraft(path: string, text: string, savedContent: string): DraftState {
  if (text === savedContent) return { path, text: null };
  return { path, text };
}

/** True only when the Draft belongs to `path` and has unsaved edits. */
export function isDirty(state: DraftState, path: string | undefined): boolean {
  return state.path === path && state.text !== null;
}

/** Discard the Draft entirely. */
export function discardDraft(_state: DraftState): DraftState {
  return emptyDraft;
}

/** Mark the Draft as saved: keep its path, clear its edits. */
export function draftSaved(state: DraftState): DraftState {
  return { path: state.path, text: null };
}
