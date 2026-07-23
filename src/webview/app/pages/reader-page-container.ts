import type { BlockAnchor } from "@mdreadr/domain";
import { defineContainer } from "@re-reduced/react";
import type { DocumentViewMode } from "../components/DocumentView.tsx";
import {
  type DraftState,
  discardDraft,
  draftSaved,
  editDraft,
  emptyDraft,
} from "../session/document-draft.ts";

export type ReaderPageState = {
  pendingAnchor: BlockAnchor | null;
  documentViewMode: DocumentViewMode;
  isDragOver: boolean;
  draft: DraftState;
};

export const readerPageContainer = defineContainer("reader-page", {
  state: {
    pendingAnchor: null,
    documentViewMode: "preview",
    isDragOver: false,
    draft: emptyDraft,
  } as ReaderPageState,
  actions: (on) => ({
    pendingAnchorChanged: on<BlockAnchor | null>((_s, pendingAnchor) => ({ pendingAnchor })),
    documentViewModeChanged: on<DocumentViewMode>((_s, documentViewMode) => ({
      documentViewMode,
    })),
    dragOverChanged: on<boolean>((_s, isDragOver) => ({ isDragOver })),
    draftEdited: on<{ path: string; text: string; savedContent: string }>(
      (_s, { path, text, savedContent }) => ({ draft: editDraft(path, text, savedContent) }),
    ),
    draftMarkedSaved: on<void>((s) => ({ draft: draftSaved(s.draft) })),
    draftDiscarded: on<void>((s) => ({ draft: discardDraft(s.draft) })),
  }),
});
