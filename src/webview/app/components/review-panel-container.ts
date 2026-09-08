import type { NoteKind } from "@mdreadr/domain";
import { defineContainer } from "@re-reduced/react";
import type { ReviewFilter } from "../review/stream.ts";

export type ReviewPanelState = {
  draft: string;
  draftKind: NoteKind;
  filter: ReviewFilter;
  replyDrafts: Record<string, string>;
  expandedReplies: Record<string, boolean>;
};

export const reviewPanelContainer = defineContainer("review-panel", {
  state: {
    draft: "",
    draftKind: "comment",
    // Open by default: settled threads are history, and a column that keeps
    // showing them buries the two items still asking something of the reader.
    filter: "open",
    replyDrafts: {},
    expandedReplies: {},
  } as ReviewPanelState,
  actions: (on) => ({
    draftChanged: on<string>((_s, draft) => ({ draft })),
    draftKindChanged: on<NoteKind>((_s, draftKind) => ({ draftKind })),
    noteSubmitted: on<void>(() => ({ draft: "", draftKind: "comment" as NoteKind })),
    filterChanged: on<ReviewFilter>((_s, filter) => ({ filter })),
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
