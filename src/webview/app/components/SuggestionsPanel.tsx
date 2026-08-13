import { Button } from "@astryxdesign/core/Button";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import type { Suggestion } from "@mdreadr/domain";
import { formatAuthorLabel } from "@mdreadr/domain";
import { anchorDisplayLabel } from "../markdown/anchors.ts";
import {
  ButtonRow,
  MutedText,
  NoteAnchorButton,
  NoteCard,
  NoteCardHeader,
  NoteMeta,
  PanelStack,
  ReplyBody,
} from "../ui/layout.tsx";

type SuggestionsPanelProps = {
  suggestions: Suggestion[];
  onAccept: (suggestion: Suggestion) => Promise<void>;
  onReject: (suggestion: Suggestion) => Promise<void>;
  onScrollToAnchor: (blockId: string) => void;
};

export function SuggestionsPanel({
  suggestions,
  onAccept,
  onReject,
  onScrollToAnchor,
}: SuggestionsPanelProps) {
  const pending = suggestions.filter((suggestion) => suggestion.status === "pending");

  return pending.length === 0 ? null : (
    <PanelStack>
      <MutedText>Suggestions</MutedText>
      {pending.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={() => onAccept(suggestion)}
          onReject={() => onReject(suggestion)}
          onScrollToAnchor={() => onScrollToAnchor(suggestion.anchor.blockId)}
        />
      ))}
    </PanelStack>
  );
}

type SuggestionCardProps = {
  suggestion: Suggestion;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  onScrollToAnchor: () => void;
};

function SuggestionCard({ suggestion, onAccept, onReject, onScrollToAnchor }: SuggestionCardProps) {
  const label = anchorDisplayLabel(suggestion.anchor);

  return (
    <NoteCard $status="open" className="reader-note-enter">
      <NoteCardHeader>
        <Tooltip content={`Jump to ${label}`} placement="start">
          <NoteAnchorButton type="button" onClick={onScrollToAnchor}>
            {label}
          </NoteAnchorButton>
        </Tooltip>
      </NoteCardHeader>
      <NoteMeta>
        {formatAuthorLabel(suggestion.author)} ·{" "}
        <Timestamp value={suggestion.createdAt} format="auto" isLive />
      </NoteMeta>
      <ReplyBody>{suggestion.replacementText}</ReplyBody>
      <ButtonRow className="mt-2">
        <Button label="Accept" variant="primary" onClick={() => void onAccept()} />
        <Button label="Reject" variant="secondary" onClick={() => void onReject()} />
      </ButtonRow>
    </NoteCard>
  );
}
