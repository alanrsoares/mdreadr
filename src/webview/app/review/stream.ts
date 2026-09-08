import type { Note, Suggestion } from "@mdreadr/domain";
import { match } from "@onrails/pattern";

/**
 * The review column is one stream, not two panels: a Suggestion an agent
 * raised against a Note belongs inside that Note's thread, because that is
 * where the reader is already reading the argument for it.
 */
export type ReviewFilter = "open" | "resolved" | "all";

/** A Note plus the Suggestions an agent hung on it. */
export type ThreadItem = {
  kind: "thread";
  id: string;
  note: Note;
  suggestions: Suggestion[];
  updatedAt: string;
};

/** A Suggestion with no Note to hang on: an agent opened with the edit. */
export type LooseSuggestionItem = {
  kind: "suggestion";
  id: string;
  suggestion: Suggestion;
  updatedAt: string;
};

export type ReviewItem = ThreadItem | LooseSuggestionItem;

export type ReviewCounts = { open: number; resolved: number; total: number };

const latest = (a: string, b: string): string => (a > b ? a : b);

/**
 * A thread's recency is the latest of its own edit and its Suggestions', so an
 * agent attaching an edit lifts the thread back to the top where it is seen.
 */
const threadUpdatedAt = (note: Note, suggestions: Suggestion[]): string =>
  suggestions.reduce((acc, suggestion) => latest(acc, suggestion.updatedAt), note.updatedAt);

const byUpdatedAtDesc = (a: ReviewItem, b: ReviewItem): number =>
  a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;

export function buildReviewStream(notes: Note[], suggestions: Suggestion[]): ReviewItem[] {
  const byNoteId = new Map<string, Suggestion[]>();
  for (const suggestion of suggestions) {
    if (suggestion.noteId === undefined) continue;
    byNoteId.set(suggestion.noteId, [...(byNoteId.get(suggestion.noteId) ?? []), suggestion]);
  }

  const noteIds = new Set(notes.map((note) => note.id));

  const threads: ReviewItem[] = notes.map((note) => {
    const attached = byNoteId.get(note.id) ?? [];
    return {
      kind: "thread",
      id: note.id,
      note,
      suggestions: attached,
      updatedAt: threadUpdatedAt(note, attached),
    };
  });

  // A `noteId` pointing at a Note this document no longer has would otherwise
  // take the Suggestion out of the stream entirely, so it falls back to loose.
  const loose: ReviewItem[] = suggestions
    .filter((suggestion) => suggestion.noteId === undefined || !noteIds.has(suggestion.noteId))
    .map((suggestion) => ({
      kind: "suggestion",
      id: suggestion.id,
      suggestion,
      updatedAt: suggestion.updatedAt,
    }));

  return [...threads, ...loose].sort(byUpdatedAtDesc);
}

/** Still asking something of the reader. */
export const isOpenItem = (item: ReviewItem): boolean =>
  match(item)
    .with({ kind: "thread" }, ({ note, suggestions }) => {
      const hasPending = suggestions.some((suggestion) => suggestion.status === "pending");
      return note.status === "open" || hasPending;
    })
    .with({ kind: "suggestion" }, ({ suggestion }) => suggestion.status === "pending")
    .exhaustive();

export const filterReviewStream = (items: ReviewItem[], filter: ReviewFilter): ReviewItem[] =>
  match(filter)
    .with("all", () => items)
    .with("open", () => items.filter(isOpenItem))
    .with("resolved", () => items.filter((item) => !isOpenItem(item)))
    .exhaustive();

export const countReviewStream = (items: ReviewItem[]): ReviewCounts => {
  const open = items.filter(isOpenItem).length;
  return { open, resolved: items.length - open, total: items.length };
};

export const pendingSuggestions = (item: ThreadItem): Suggestion[] =>
  item.suggestions.filter((suggestion) => suggestion.status === "pending");
