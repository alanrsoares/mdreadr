import { err, ok, type Result } from "@onrails/result";
import type {
  BlockAnchor,
  CreateSuggestionInput,
  Suggestion,
  SuggestionStatus,
} from "../schemas/index.ts";
import { resolveBlockText } from "./anchors.ts";
import { newId, nowIso } from "./notes.ts";

export type SuggestionDomainError = { _tag: "SuggestionNotFound"; id: string };

export function findSuggestion(
  suggestions: Suggestion[],
  id: string,
): Result<Suggestion, SuggestionDomainError> {
  const suggestion = suggestions.find((item) => item.id === id);
  return !suggestion ? err({ _tag: "SuggestionNotFound", id }) : ok(suggestion);
}

export function createSuggestion(input: CreateSuggestionInput): Suggestion {
  const timestamp = nowIso();
  return {
    id: newId(),
    anchor: input.anchor,
    replacementText: input.replacementText,
    noteId: input.noteId,
    author: input.author,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export const setSuggestionStatus = (
  suggestion: Suggestion,
  status: SuggestionStatus,
): Suggestion => ({
  ...suggestion,
  status,
  updatedAt: nowIso(),
});

/**
 * Applies a Suggestion's replacement text into Document content, splicing at
 * the anchor's *current* block text (resolved via `resolveBlockText`).
 * Returns `undefined` if the anchor no longer resolves against `content`.
 *
 * Known gap: for non-document anchors this replaces the first textual match
 * of the resolved block text, an approximation rather than an exact source
 * span — safe for paragraph/code blocks (matched via content hash) but can
 * mis-splice if the same text also appears verbatim elsewhere in a heading
 * section. Accepted as MVP scope, same tier as `resolveBlockText`'s own gap.
 */
export function applySuggestion(content: string, anchor: BlockAnchor, replacementText: string) {
  const currentText = resolveBlockText(content, anchor);
  if (currentText === undefined) return undefined;
  if (anchor.kind === "document") return replacementText;
  return content.replace(currentText, replacementText);
}
