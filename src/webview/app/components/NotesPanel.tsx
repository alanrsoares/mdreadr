import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import type { BlockAnchor, Note, NoteStatus } from "@mdreadr/domain";
import { formatAuthorLabel } from "@mdreadr/domain";
import { useMemo, useState } from "react";
import {
  ButtonRow,
  MutedText,
  NoteCard,
  NoteCardHeader,
  NoteMeta,
  PanelStack,
  ReplyAuthor,
  ReplyBubble,
  ReplyList,
} from "../ui/layout.tsx";

type NotesPanelProps = {
  notes: Note[];
  pendingAnchor: BlockAnchor | null;
  onCreateNote: (input: { anchor: BlockAnchor; body: string }) => Promise<void>;
  onAddReply: (noteId: string, body: string) => Promise<void>;
  onUpdateStatus: (noteId: string, status: NoteStatus) => Promise<void>;
  onSaveNotes: () => Promise<void>;
  onLoadNotes: () => Promise<void>;
};

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "wontfix", label: "Won't fix" },
];

export function NotesPanel({
  notes,
  pendingAnchor,
  onCreateNote,
  onAddReply,
  onUpdateStatus,
  onSaveNotes,
  onLoadNotes,
}: NotesPanelProps) {
  const [draft, setDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) =>
        a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
      ),
    [notes],
  );

  return (
    <PanelStack>
      <ButtonRow>
        <Button label="Save notes" variant="primary" onClick={() => void onSaveNotes()} />
        <Button label="Open notes" variant="secondary" onClick={() => void onLoadNotes()} />
      </ButtonRow>

      {pendingAnchor ? (
        <NoteCard $status="open">
          <MutedText>
            New note on <strong>{pendingAnchor.kind}</strong>
            {pendingAnchor.headingPath?.length
              ? `: ${pendingAnchor.headingPath.join(" › ")}`
              : null}
          </MutedText>
          <TextArea
            label="New note"
            isLabelHidden
            value={draft}
            onChange={setDraft}
            placeholder="Start a thread…"
            rows={4}
          />
          <div className="mt-2">
            <Button
              label="Add note"
              variant="primary"
              isDisabled={draft.trim().length === 0}
              onClick={() => {
                void onCreateNote({
                  anchor: pendingAnchor,
                  body: draft.trim(),
                }).then(() => setDraft(""));
              }}
            />
          </div>
        </NoteCard>
      ) : (
        <MutedText>Right-click a heading, paragraph, or code block to pin a note.</MutedText>
      )}

      {sortedNotes.map((note) => (
        <NoteCardItem
          key={note.id}
          note={note}
          replyDraft={replyDrafts[note.id] ?? ""}
          onReplyDraftChange={(value) =>
            setReplyDrafts((current) => ({ ...current, [note.id]: value }))
          }
          onAddReply={(body) => onAddReply(note.id, body)}
          onUpdateStatus={(status) => onUpdateStatus(note.id, status)}
        />
      ))}
    </PanelStack>
  );
}

function NoteCardItem({
  note,
  replyDraft,
  onReplyDraftChange,
  onAddReply,
  onUpdateStatus,
}: {
  note: Note;
  replyDraft: string;
  onReplyDraftChange: (value: string) => void;
  onAddReply: (body: string) => Promise<void>;
  onUpdateStatus: (status: NoteStatus) => Promise<void>;
}) {
  return (
    <NoteCard $status={note.status}>
      <NoteCardHeader>
        <strong>{note.anchor.kind}</strong>
        <select
          aria-label="Note status"
          value={note.status}
          onChange={(event) => {
            void onUpdateStatus(event.target.value as NoteStatus);
          }}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </NoteCardHeader>
      {note.anchor.headingPath?.length ? (
        <NoteMeta>{note.anchor.headingPath.join(" › ")}</NoteMeta>
      ) : null}

      <ReplyList>
        {note.replies.map((reply) => (
          <ReplyBubble key={reply.id}>
            <ReplyAuthor>{formatAuthorLabel(reply.author)}</ReplyAuthor>
            <div>{reply.body}</div>
          </ReplyBubble>
        ))}
      </ReplyList>

      <TextArea
        label="Reply"
        isLabelHidden
        value={replyDraft}
        onChange={onReplyDraftChange}
        placeholder="Reply…"
        rows={3}
        style={{ marginTop: "8px" }}
      />
      <Button
        label="Reply"
        variant="secondary"
        isDisabled={replyDraft.trim().length === 0}
        onClick={() => {
          void onAddReply(replyDraft.trim()).then(() => onReplyDraftChange(""));
        }}
        style={{ marginTop: "8px" }}
      />
    </NoteCard>
  );
}
