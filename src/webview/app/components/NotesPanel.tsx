import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import type { BlockAnchor, Note, NoteKind, NoteStatus } from "@mdreadr/domain";
import { formatAuthorLabel } from "@mdreadr/domain";
import { useContainer, useStoreValues } from "@re-reduced/react";
import { useEffect, useMemo, useRef } from "react";
import { anchorDisplayLabel } from "../markdown/anchors.ts";
import {
  ButtonRow,
  MutedText,
  NoteAnchorButton,
  NoteCard,
  NoteCardHeader,
  NoteKindBadge,
  NoteMeta,
  PanelStack,
  ReplyAuthor,
  ReplyBody,
  ReplyBubble,
  ReplyList,
  ReplyStack,
} from "../ui/layout.tsx";
import { notesPanelContainer } from "./notes-panel-container.ts";

type NotesPanelProps = {
  notes: Note[];
  pendingAnchor: BlockAnchor | null;
  isSaving?: boolean;
  isLoadingNotes?: boolean;
  isCreatingNote?: boolean;
  onCreateNote: (input: { anchor: BlockAnchor; body: string; kind?: NoteKind }) => Promise<void>;
  onAddReply: (noteId: string, body: string) => Promise<void>;
  onUpdateStatus: (noteId: string, status: NoteStatus) => Promise<void>;
  onSaveNotes: () => Promise<void>;
  onLoadNotes: () => Promise<void>;
  onScrollToAnchor: (blockId: string) => void;
};

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "wontfix", label: "Won't fix" },
];

const kindOptions = [
  { value: "comment", label: "Comment" },
  { value: "request", label: "Edit request" },
];

const formatNoteTime = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

export function NotesPanel({
  notes,
  pendingAnchor,
  isSaving = false,
  isLoadingNotes = false,
  isCreatingNote = false,
  onCreateNote,
  onAddReply,
  onUpdateStatus,
  onSaveNotes,
  onLoadNotes,
  onScrollToAnchor,
}: NotesPanelProps) {
  const store = useContainer(notesPanelContainer);
  const { draft, draftKind, replyDrafts, expandedReplies, canSubmitNote } = useStoreValues(store);
  const composerRef = useRef<HTMLDivElement>(null);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) =>
        a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
      ),
    [notes],
  );

  useEffect(() => {
    if (!pendingAnchor) return;
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pendingAnchor]);

  return (
    <PanelStack>
      <ButtonRow>
        <Button
          label="Save notes"
          variant="primary"
          isLoading={isSaving}
          onClick={() => void onSaveNotes()}
        />
        <Button
          label="Open notes"
          variant="secondary"
          isLoading={isLoadingNotes}
          onClick={() => void onLoadNotes()}
        />
      </ButtonRow>

      {pendingAnchor ? (
        <div ref={composerRef}>
          <NoteCard $status="open" className="reader-composer-attention">
            <MutedText>
              New note on <strong>{anchorDisplayLabel(pendingAnchor)}</strong>
            </MutedText>
            <Selector
              label="Kind"
              isLabelHidden
              size="sm"
              options={kindOptions}
              value={draftKind}
              onChange={(value) => {
                if (value === "comment" || value === "request") {
                  store.actions.draftKindChanged(value);
                }
              }}
            />
            <TextArea
              label="New note"
              isLabelHidden
              hasAutoFocus
              value={draft}
              onChange={store.actions.draftChanged}
              placeholder="Start a thread…"
              rows={4}
            />
            <div className="mt-2">
              <Button
                label="Add note"
                variant="primary"
                isDisabled={!canSubmitNote}
                isLoading={isCreatingNote}
                onClick={() => {
                  void onCreateNote({
                    anchor: pendingAnchor,
                    body: draft.trim(),
                    kind: draftKind,
                  }).then(() => {
                    store.actions.noteSubmitted();
                  });
                }}
              />
            </div>
          </NoteCard>
        </div>
      ) : (
        <MutedText>
          Hover a block and choose Pin, or use the pin control beside headings, paragraphs, and
          code.
        </MutedText>
      )}

      {sortedNotes.map((note, index) => (
        <NoteCardItem
          key={note.id}
          note={note}
          enterDelayMs={Math.min(index, 6) * 40}
          replyDraft={replyDrafts[note.id] ?? ""}
          isReplyOpen={expandedReplies[note.id] ?? false}
          onToggleReply={() => store.actions.replyToggled(note.id)}
          onReplyDraftChange={(value) =>
            store.actions.replyDraftChanged({ noteId: note.id, value })
          }
          onReplySubmitted={() => store.actions.replySubmitted(note.id)}
          onAddReply={(body) => onAddReply(note.id, body)}
          onUpdateStatus={(status) => onUpdateStatus(note.id, status)}
          onScrollToAnchor={() => onScrollToAnchor(note.anchor.blockId)}
        />
      ))}
    </PanelStack>
  );
}

function NoteCardItem({
  note,
  enterDelayMs,
  replyDraft,
  isReplyOpen,
  onToggleReply,
  onReplyDraftChange,
  onReplySubmitted,
  onAddReply,
  onUpdateStatus,
  onScrollToAnchor,
}: {
  note: Note;
  enterDelayMs: number;
  replyDraft: string;
  isReplyOpen: boolean;
  onToggleReply: () => void;
  onReplyDraftChange: (value: string) => void;
  onReplySubmitted: () => void;
  onAddReply: (body: string) => Promise<void>;
  onUpdateStatus: (status: NoteStatus) => Promise<void>;
  onScrollToAnchor: () => void;
}) {
  return (
    <NoteCard
      $status={note.status}
      className="reader-note-enter"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <NoteCardHeader>
        <NoteAnchorLink anchor={note.anchor} onClick={onScrollToAnchor} />
        {note.kind === "request" ? <NoteKindBadge>Edit request</NoteKindBadge> : null}
        <Selector
          label="Status"
          isLabelHidden
          size="sm"
          options={statusOptions}
          value={note.status}
          onChange={(value) => {
            if (value === "open" || value === "resolved" || value === "wontfix") {
              void onUpdateStatus(value);
            }
          }}
        />
      </NoteCardHeader>
      <NoteMeta>Updated {formatNoteTime(note.updatedAt)}</NoteMeta>

      <ReplyList>
        {note.replies.map((reply) => (
          <ReplyBubble key={reply.id}>
            <ReplyAuthor>
              {formatAuthorLabel(reply.author)} · {formatNoteTime(reply.createdAt)}
            </ReplyAuthor>
            <ReplyBody>{reply.body}</ReplyBody>
          </ReplyBubble>
        ))}
      </ReplyList>

      {isReplyOpen ? (
        <ReplyStack className="reader-reveal">
          <TextArea
            label="Reply"
            isLabelHidden
            value={replyDraft}
            onChange={onReplyDraftChange}
            placeholder="Reply…"
            rows={3}
          />
          <Button
            label="Reply"
            variant="secondary"
            isDisabled={replyDraft.trim().length === 0}
            onClick={() => {
              void onAddReply(replyDraft.trim()).then(onReplySubmitted);
            }}
          />
        </ReplyStack>
      ) : (
        <div className="mt-2">
          <Button label="Reply…" variant="secondary" onClick={onToggleReply} />
        </div>
      )}
    </NoteCard>
  );
}

function NoteAnchorLink({ anchor, onClick }: { anchor: BlockAnchor; onClick: () => void }) {
  const label = anchorDisplayLabel(anchor);

  return (
    <Tooltip content={`Jump to ${label}`} placement="start">
      <NoteAnchorButton type="button" onClick={onClick}>
        {label}
      </NoteAnchorButton>
    </Tooltip>
  );
}
