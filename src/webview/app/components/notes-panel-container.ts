import type { NoteKind } from "@mdreadr/domain";
import { defineContainer } from "@re-reduced/react";

export type NotesPanelState = {
  draft: string;
  draftKind: NoteKind;
  replyDrafts: Record<string, string>;
  expandedReplies: Record<string, boolean>;
};

export const notesPanelContainer = defineContainer("notes-panel", {
  state: {
    draft: "",
    draftKind: "comment",
    replyDrafts: {},
    expandedReplies: {},
  } as NotesPanelState,
  actions: (on) => ({
    draftChanged: on<string>((_s, draft) => ({ draft })),
    draftKindChanged: on<NoteKind>((_s, draftKind) => ({ draftKind })),
    noteSubmitted: on<void>(() => ({ draft: "", draftKind: "comment" as NoteKind })),
    replyDraftChanged: on<{ noteId: string; value: string }>((s, { noteId, value }) => ({
      replyDrafts: { ...s.replyDrafts, [noteId]: value },
    })),
    replyToggled: on<string>((s, noteId) => ({
      expandedReplies: { ...s.expandedReplies, [noteId]: !s.expandedReplies[noteId] },
    })),
    replySubmitted: on<string>((s, noteId) => {
      const replyDrafts = { ...s.replyDrafts };
      delete replyDrafts[noteId];
      return { replyDrafts };
    }),
  }),
  derive: ($state) => ({
    canSubmitNote: () => $state.draft.value.trim().length > 0,
  }),
});
