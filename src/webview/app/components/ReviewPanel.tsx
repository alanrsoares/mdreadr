import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import type {
  Author,
  BlockAnchor,
  CreateNoteRequest,
  Note,
  NoteKind,
  NoteStatus,
  Reply,
  Suggestion,
} from "@mdreadr/domain";
import { formatAuthorLabel } from "@mdreadr/domain";
import { match } from "@onrails/pattern";
import { useContainer, useStoreValues } from "@re-reduced/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatBubbleBottomCenterTextIcon,
  CheckIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  XMarkIcon,
} from "../icons.ts";
import { anchorDisplayLabel } from "../markdown/anchors.ts";
import {
  buildReviewStream,
  countReviewStream,
  filterReviewStream,
  pendingSuggestions,
  type ReviewCounts,
  type ReviewFilter,
  type ReviewItem,
  searchReviewStream,
  type ThreadItem,
} from "../review/stream.ts";
import {
  ButtonRow,
  MessageAuthor,
  MessageBody,
  MessageBubble,
  MessageList,
  MutedText,
  NoteAnchorButton,
  ReplyStack,
  ReviewBody,
  ReviewColumn,
  ReviewFooter,
  ReviewHeader,
  ReviewStack,
  ReviewTitleGroup,
  SuggestionCard,
  SuggestionText,
  ThreadActions,
  ThreadBadges,
  ThreadCard,
  ThreadHeader,
  ThreadMeta,
  ThreadMetaRow,
} from "../ui/layout.tsx";
import { reviewPanelContainer } from "./review-panel-container.ts";

type ReviewPanelProps = {
  notes: Note[];
  suggestions: Suggestion[];
  pendingAnchor: BlockAnchor | null;
  isSaving?: boolean;
  isLoadingNotes?: boolean;
  isCreatingNote?: boolean;
  onCreateNote: (input: CreateNoteRequest) => Promise<void>;
  onAddReply: (noteId: string, body: string) => Promise<void>;
  onUpdateStatus: (noteId: string, status: NoteStatus) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onAcceptSuggestion: (suggestion: Suggestion) => Promise<void>;
  onRejectSuggestion: (suggestion: Suggestion) => Promise<void>;
  onSaveNotes: () => Promise<void>;
  onLoadNotes: () => Promise<void>;
  onScrollToAnchor: (blockId: string) => void;
};

/**
 * The review column: Notes and the Suggestions agents raise against them, in
 * one stream. A Suggestion attached to a Note renders inside that Note's
 * thread, so accepting an edit happens where its argument is, not in a
 * separate panel the reader has to correlate by hand.
 */
export function ReviewPanel({
  notes,
  suggestions,
  pendingAnchor,
  isSaving = false,
  isLoadingNotes = false,
  isCreatingNote = false,
  onCreateNote,
  onAddReply,
  onUpdateStatus,
  onDeleteNote,
  onAcceptSuggestion,
  onRejectSuggestion,
  onSaveNotes,
  onLoadNotes,
  onScrollToAnchor,
}: ReviewPanelProps) {
  const store = useContainer(reviewPanelContainer);
  const { draft, draftKind, filter, search, replyDrafts, expandedReplies, canSubmitNote } =
    useStoreValues(store);
  const composerRef = useRef<HTMLDivElement>(null);

  const stream = useMemo(() => buildReviewStream(notes, suggestions), [notes, suggestions]);
  const counts = useMemo(() => countReviewStream(stream), [stream]);
  // Search narrows what the filter already chose, so a reader searching inside
  // Open does not silently get settled threads back.
  const visible = useMemo(
    () => searchReviewStream(filterReviewStream(stream, filter), search),
    [stream, filter, search],
  );

  useEffect(() => {
    if (!pendingAnchor) return;
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pendingAnchor]);

  return (
    <ReviewColumn>
      <ReviewHeader>
        <ReviewTitleGroup>
          <Text type="label">Review</Text>
          <Text type="supporting" size="xsm">
            {counts.open} open
          </Text>
        </ReviewTitleGroup>
        <SegmentedControl
          label="Filter review items"
          size="sm"
          layout="fill"
          value={filter}
          onChange={(value) => store.actions.filterChanged(value as ReviewFilter)}
        >
          <SegmentedControlItem value="open" label="Open" />
          <SegmentedControlItem value="resolved" label="Done" />
          <SegmentedControlItem value="all" label="All" />
        </SegmentedControl>
        <TextInput
          label="Search review"
          isLabelHidden
          size="sm"
          hasClear
          placeholder="Search threads"
          startIcon={<Icon icon={MagnifyingGlassIcon} size="sm" />}
          value={search}
          onChange={store.actions.searchChanged}
        />
      </ReviewHeader>

      <ReviewBody>
        <ReviewStack>
          {pendingAnchor ? (
            <div ref={composerRef}>
              <Composer
                anchor={pendingAnchor}
                draft={draft}
                draftKind={draftKind}
                canSubmit={canSubmitNote}
                isCreating={isCreatingNote}
                onDraftChange={store.actions.draftChanged}
                onKindChange={store.actions.draftKindChanged}
                onSubmit={() => {
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
          ) : null}

          {visible.length === 0 ? (
            <ReviewEmptyState filter={filter} counts={counts} search={search} />
          ) : (
            visible.map((item, index) => (
              <ReviewItemCard
                key={item.id}
                item={item}
                enterDelayMs={Math.min(index, 6) * 40}
                replyDraft={replyDrafts[item.id] ?? ""}
                isReplyOpen={expandedReplies[item.id] ?? false}
                onToggleReply={() => store.actions.replyToggled(item.id)}
                onReplyDraftChange={(value) =>
                  store.actions.replyDraftChanged({ noteId: item.id, value })
                }
                onReplySubmitted={() => store.actions.replySubmitted(item.id)}
                onAddReply={(body) => onAddReply(item.id, body)}
                onUpdateStatus={(status) => onUpdateStatus(item.id, status)}
                onDeleteNote={() => onDeleteNote(item.id)}
                onAcceptSuggestion={onAcceptSuggestion}
                onRejectSuggestion={onRejectSuggestion}
                onScrollToAnchor={onScrollToAnchor}
              />
            ))
          )}
        </ReviewStack>
      </ReviewBody>

      {/* The disk lives at the bottom: saving and loading notes.json is the
          rarest thing done in this column, and it is named for the file. */}
      <ReviewFooter>
        <Button
          label="Save to file"
          variant="ghost"
          size="sm"
          isLoading={isSaving}
          onClick={() => void onSaveNotes()}
        />
        <Button
          label="Load from file"
          variant="ghost"
          size="sm"
          isLoading={isLoadingNotes}
          onClick={() => void onLoadNotes()}
        />
      </ReviewFooter>
    </ReviewColumn>
  );
}

const emptyCopy = (filter: ReviewFilter, hasAny: boolean): { title: string; description: string } =>
  match(filter)
    .with("resolved", () => ({
      title: "Nothing settled yet",
      description: "Threads you resolve or set to won't fix collect here.",
    }))
    .with("open", () =>
      hasAny
        ? {
            title: "Nothing open",
            description: "Every thread on this document is settled. Switch to All to reread them.",
          }
        : { title: "No review yet", description: START_HINT },
    )
    .with("all", () => ({ title: "No review yet", description: START_HINT }))
    .exhaustive();

const START_HINT =
  "Use the anchor control beside a heading, paragraph, or code block. It appears when you hover or focus the block.";

type ReviewEmptyStateProps = { filter: ReviewFilter; counts: ReviewCounts; search: string };

function ReviewEmptyState({ filter, counts, search }: ReviewEmptyStateProps) {
  // A search that matched nothing is the reader's own doing, so it says so
  // rather than claiming the document has no review on it.
  const { title, description } =
    search.trim() === ""
      ? emptyCopy(filter, counts.total > 0)
      : {
          title: "No match",
          description: `Nothing in this column contains "${search.trim()}". Clear the search, or widen the filter to All.`,
        };

  return (
    <EmptyState
      isCompact
      className="reader-empty-enter"
      icon={<Icon icon={ChatBubbleBottomCenterTextIcon} size="lg" />}
      title={title}
      description={description}
    />
  );
}

type ComposerProps = {
  anchor: BlockAnchor;
  draft: string;
  draftKind: NoteKind;
  canSubmit: boolean;
  isCreating: boolean;
  onDraftChange: (value: string) => void;
  onKindChange: (kind: NoteKind) => void;
  onSubmit: () => void;
};

function Composer({
  anchor,
  draft,
  draftKind,
  canSubmit,
  isCreating,
  onDraftChange,
  onKindChange,
  onSubmit,
}: ComposerProps) {
  return (
    <ThreadCard className="reader-composer-attention">
      <MutedText>
        New note on <strong>{anchorDisplayLabel(anchor)}</strong>
      </MutedText>
      <SegmentedControl
        label="Note kind"
        size="sm"
        layout="fill"
        value={draftKind}
        onChange={(value) => {
          if (value === "comment" || value === "request") onKindChange(value);
        }}
      >
        <SegmentedControlItem value="comment" label="Comment" />
        <SegmentedControlItem value="request" label="Edit request" />
      </SegmentedControl>
      <TextArea
        label="New note"
        isLabelHidden
        hasAutoFocus
        value={draft}
        onChange={onDraftChange}
        placeholder="Start a thread…"
        rows={4}
      />
      <div>
        <Button
          label="Add note"
          variant="primary"
          size="sm"
          isDisabled={!canSubmit}
          isLoading={isCreating}
          onClick={onSubmit}
        />
      </div>
    </ThreadCard>
  );
}

type ReviewItemCardProps = {
  item: ReviewItem;
  enterDelayMs: number;
  replyDraft: string;
  isReplyOpen: boolean;
  onToggleReply: () => void;
  onReplyDraftChange: (value: string) => void;
  onReplySubmitted: () => void;
  onAddReply: (body: string) => Promise<void>;
  onUpdateStatus: (status: NoteStatus) => Promise<void>;
  onDeleteNote: () => Promise<void>;
  onAcceptSuggestion: (suggestion: Suggestion) => Promise<void>;
  onRejectSuggestion: (suggestion: Suggestion) => Promise<void>;
  onScrollToAnchor: (blockId: string) => void;
};

function ReviewItemCard({ item, ...rest }: ReviewItemCardProps) {
  return match(item)
    .with({ kind: "thread" }, (thread) => <ThreadItemCard item={thread} {...rest} />)
    .with({ kind: "suggestion" }, ({ suggestion }) => (
      <LooseSuggestionCard
        suggestion={suggestion}
        enterDelayMs={rest.enterDelayMs}
        onAccept={() => rest.onAcceptSuggestion(suggestion)}
        onReject={() => rest.onRejectSuggestion(suggestion)}
        onScrollToAnchor={() => rest.onScrollToAnchor(suggestion.anchor.blockId)}
      />
    ))
    .exhaustive();
}

type ThreadItemCardProps = Omit<ReviewItemCardProps, "item"> & { item: ThreadItem };

function ThreadItemCard({
  item,
  enterDelayMs,
  replyDraft,
  isReplyOpen,
  onToggleReply,
  onReplyDraftChange,
  onReplySubmitted,
  onAddReply,
  onUpdateStatus,
  onAcceptSuggestion,
  onRejectSuggestion,
  onScrollToAnchor,
  onDeleteNote,
}: ThreadItemCardProps) {
  const { note } = item;
  const pending = pendingSuggestions(item);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <ThreadCard
      $tone={note.status === "open" ? "open" : "settled"}
      className="reader-note-enter"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <ThreadHeader>
        <AnchorLink anchor={note.anchor} onClick={() => onScrollToAnchor(note.anchor.blockId)} />
        {note.kind === "request" || note.status !== "open" ? (
          <ThreadBadges>
            {note.kind === "request" ? <Badge variant="blue" label="Edit request" /> : null}
            {note.status === "open" ? null : (
              <Badge
                variant="neutral"
                label={note.status === "resolved" ? "Resolved" : "Won't fix"}
              />
            )}
          </ThreadBadges>
        ) : null}
        <ThreadMetaRow>
          <ThreadMeta>
            Updated <Timestamp value={note.updatedAt} format="auto" isLive />
          </ThreadMeta>
          <StatusActions
            status={note.status}
            onUpdateStatus={onUpdateStatus}
            onDelete={() => setIsConfirmingDelete(true)}
          />
        </ThreadMetaRow>
      </ThreadHeader>

      <MessageList>
        {note.replies.map((reply) => (
          <MessageTurn key={reply.id} reply={reply} />
        ))}
        {pending.map((suggestion) => (
          <SuggestionTurn
            key={suggestion.id}
            suggestion={suggestion}
            onAccept={() => onAcceptSuggestion(suggestion)}
            onReject={() => onRejectSuggestion(suggestion)}
          />
        ))}
      </MessageList>

      {/* Session Notes live in memory until they are saved to a file, so a
          deleted thread is gone with no undo to offer. That is the one thing in
          this column worth a dialog. */}
      <AlertDialog
        isOpen={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title="Delete this note?"
        description={`${anchorDisplayLabel(note.anchor)}: ${note.replies.length} ${
          note.replies.length === 1 ? "message" : "messages"
        }. Deleting cannot be undone.`}
        cancelLabel="Keep"
        actionLabel="Delete"
        actionVariant="destructive"
        onAction={() => {
          setIsConfirmingDelete(false);
          void onDeleteNote();
        }}
      />

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
          <div>
            <Button
              label="Reply"
              variant="secondary"
              size="sm"
              isDisabled={replyDraft.trim().length === 0}
              onClick={() => {
                void onAddReply(replyDraft.trim()).then(onReplySubmitted);
              }}
            />
          </div>
        </ReplyStack>
      ) : (
        <div>
          <Button label="Reply…" variant="ghost" size="sm" onClick={onToggleReply} />
        </div>
      )}
    </ThreadCard>
  );
}

type StatusActionsProps = {
  status: NoteStatus;
  onUpdateStatus: (status: NoteStatus) => Promise<void>;
  onDelete: () => void;
};

/**
 * Replaces the per-card status dropdown. Quiet at rest, revealed on hover or
 * focus, and every status is one click rather than two.
 */
function StatusActions({ status, onUpdateStatus, onDelete }: StatusActionsProps) {
  return (
    <ThreadActions>
      {status === "open" ? (
        <>
          <Button
            label="Resolve"
            variant="ghost"
            size="sm"
            isIconOnly
            icon={<Icon icon={CheckIcon} size="sm" />}
            tooltip="Resolve"
            onClick={() => void onUpdateStatus("resolved")}
          />
          <Button
            label="Won't fix"
            variant="ghost"
            size="sm"
            isIconOnly
            icon={<Icon icon={XMarkIcon} size="sm" />}
            tooltip="Won't fix"
            onClick={() => void onUpdateStatus("wontfix")}
          />
        </>
      ) : (
        <Button
          label="Reopen"
          variant="ghost"
          size="sm"
          onClick={() => void onUpdateStatus("open")}
        />
      )}
      <Button
        label="Delete note"
        variant="ghost"
        size="sm"
        isIconOnly
        icon={<Icon icon={TrashIcon} size="sm" />}
        tooltip="Delete note"
        onClick={onDelete}
      />
    </ThreadActions>
  );
}

const authorIcon = (author: Author) =>
  match(author.kind)
    .with("human", () => null)
    .with("agent", () => <Icon icon={CommandLineIcon} size="xsm" />)
    .with("system", () => <Icon icon={Cog6ToothIcon} size="xsm" />)
    .exhaustive();

type MessageTurnProps = { reply: Reply };

function MessageTurn({ reply }: MessageTurnProps) {
  return (
    <MessageBubble $author={reply.author.kind}>
      <MessageAuthor>
        {authorIcon(reply.author)}
        {formatAuthorLabel(reply.author)} ·{" "}
        <Timestamp value={reply.createdAt} format="auto" size="xsm" isLive />
      </MessageAuthor>
      <MessageBody>{reply.body}</MessageBody>
    </MessageBubble>
  );
}

type SuggestionTurnProps = {
  suggestion: Suggestion;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
};

/** An agent's proposed edit, in the thread it answers. */
function SuggestionTurn({ suggestion, onAccept, onReject }: SuggestionTurnProps) {
  return (
    <SuggestionCard>
      <MessageAuthor>
        {authorIcon(suggestion.author)}
        {formatAuthorLabel(suggestion.author)} suggests ·{" "}
        <Timestamp value={suggestion.createdAt} format="auto" size="xsm" isLive />
      </MessageAuthor>
      <SuggestionText>{suggestion.replacementText}</SuggestionText>
      <ButtonPair onAccept={onAccept} onReject={onReject} />
    </SuggestionCard>
  );
}

type LooseSuggestionCardProps = {
  suggestion: Suggestion;
  enterDelayMs: number;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  onScrollToAnchor: () => void;
};

function LooseSuggestionCard({
  suggestion,
  enterDelayMs,
  onAccept,
  onReject,
  onScrollToAnchor,
}: LooseSuggestionCardProps) {
  return (
    <ThreadCard
      $tone={suggestion.status === "pending" ? "open" : "settled"}
      className="reader-note-enter"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <ThreadHeader>
        <AnchorLink anchor={suggestion.anchor} onClick={onScrollToAnchor} />
        <ThreadMetaRow>
          <ThreadBadges>
            <Badge variant="blue" label="Suggestion" />
          </ThreadBadges>
        </ThreadMetaRow>
      </ThreadHeader>
      <MessageAuthor>
        {authorIcon(suggestion.author)}
        {formatAuthorLabel(suggestion.author)} ·{" "}
        <Timestamp value={suggestion.createdAt} format="auto" size="xsm" isLive />
      </MessageAuthor>
      <SuggestionText>{suggestion.replacementText}</SuggestionText>
      {suggestion.status === "pending" ? (
        <ButtonPair onAccept={onAccept} onReject={onReject} />
      ) : null}
    </ThreadCard>
  );
}

type ButtonPairProps = { onAccept: () => Promise<void>; onReject: () => Promise<void> };

function ButtonPair({ onAccept, onReject }: ButtonPairProps) {
  return (
    <ButtonRow>
      <Button label="Accept" variant="primary" size="sm" onClick={() => void onAccept()} />
      <Button label="Reject" variant="ghost" size="sm" onClick={() => void onReject()} />
    </ButtonRow>
  );
}

type AnchorLinkProps = { anchor: BlockAnchor; onClick: () => void };

function AnchorLink({ anchor, onClick }: AnchorLinkProps) {
  const label = anchorDisplayLabel(anchor);

  return (
    <Tooltip content={`Jump to ${label}`} placement="start">
      <NoteAnchorButton type="button" onClick={onClick}>
        {label}
      </NoteAnchorButton>
    </Tooltip>
  );
}
