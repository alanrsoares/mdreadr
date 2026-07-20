import { homedir } from "node:os";
import type { Author, DocumentRef, Note, Suggestion } from "../domain/index.ts";
import { nowIso } from "../domain/index.ts";

export type SessionSnapshot = {
  document: DocumentRef | null;
  documentContent: string | null;
  notes: Note[];
  suggestions: Suggestion[];
  homeDirectory: string;
};

export type JournalEventType =
  | "note_added"
  | "note_replied"
  | "note_status_changed"
  | "suggestion_added"
  | "suggestion_status_changed";

export type JournalEntry = {
  seq: number;
  ts: string;
  type: JournalEventType;
  entityId: string;
};

/**
 * Compact snapshot of the entity a journal entry refers to, attached to events
 * so a watcher can act on what changed without a follow-up get_note/get_suggestion
 * round-trip. `null` when the entity is gone (e.g. notes reloaded from disk).
 */
export type EventSummary =
  | {
      entity: "note";
      kind: Note["kind"];
      status: Note["status"];
      blockId: string;
      label?: string;
      replies: number;
      lastAuthor?: Author["kind"];
    }
  | {
      entity: "suggestion";
      status: Suggestion["status"];
      blockId: string;
      noteId?: string;
      author: Author["kind"];
    };

export type EnrichedJournalEntry = JournalEntry & { summary: EventSummary | null };

type Waiter = {
  sinceSeq: number;
  resolve: (entries: JournalEntry[]) => void;
};

export class SessionStore {
  private document: DocumentRef | null = null;
  private documentContent: string | null = null;
  private notes: Note[] = [];
  private suggestions: Suggestion[] = [];
  private journal: JournalEntry[] = [];
  private nextSeq = 1;
  private waiters: Waiter[] = [];

  snapshot(): SessionSnapshot {
    return {
      document: this.document,
      documentContent: this.documentContent,
      notes: [...this.notes],
      suggestions: [...this.suggestions],
      homeDirectory: process.env.HOME ?? homedir(),
    };
  }

  setDocument(document: DocumentRef, content: string): void {
    this.document = document;
    this.documentContent = content;
  }

  clearDocument(): void {
    this.document = null;
    this.documentContent = null;
  }

  getNotes(): Note[] {
    return [...this.notes];
  }

  setNotes(notes: Note[]): void {
    this.notes = [...notes];
  }

  replaceNote(note: Note): void {
    this.notes = this.notes.map((item) => (item.id === note.id ? note : item));
  }

  addNote(note: Note): void {
    this.notes = [...this.notes, note];
    this.appendEvent("note_added", note.id);
  }

  noteReplied(note: Note): void {
    this.replaceNote(note);
    this.appendEvent("note_replied", note.id);
  }

  noteStatusChanged(note: Note): void {
    this.replaceNote(note);
    this.appendEvent("note_status_changed", note.id);
  }

  getSuggestions(): Suggestion[] {
    return [...this.suggestions];
  }

  setSuggestions(suggestions: Suggestion[]): void {
    this.suggestions = [...suggestions];
  }

  addSuggestion(suggestion: Suggestion): void {
    this.suggestions = [...this.suggestions, suggestion];
    this.appendEvent("suggestion_added", suggestion.id);
  }

  replaceSuggestion(suggestion: Suggestion): void {
    this.suggestions = this.suggestions.map((item) =>
      item.id === suggestion.id ? suggestion : item,
    );
  }

  suggestionStatusChanged(suggestion: Suggestion): void {
    this.replaceSuggestion(suggestion);
    this.appendEvent("suggestion_status_changed", suggestion.id);
  }

  /** Journal entries with `seq > sinceSeq`, oldest first — a non-blocking catch-up read. */
  getEvents(sinceSeq: number): JournalEntry[] {
    return this.journal.filter((entry) => entry.seq > sinceSeq);
  }

  /**
   * Highest seq issued so far (0 before any event). A fresh subscriber seeds
   * `sinceSeq` with this to start watching from "now" instead of replaying the
   * whole journal as if it were new.
   */
  latestSeq(): number {
    return this.nextSeq - 1;
  }

  /** Compact snapshot of the entity a journal entry points at; `null` if it is gone. */
  describeEvent(entry: JournalEntry): EventSummary | null {
    if (entry.type.startsWith("suggestion_")) {
      const suggestion = this.suggestions.find((item) => item.id === entry.entityId);
      if (!suggestion) return null;
      return {
        entity: "suggestion",
        status: suggestion.status,
        blockId: suggestion.anchor.blockId,
        noteId: suggestion.noteId,
        author: suggestion.author.kind,
      };
    }
    const note = this.notes.find((item) => item.id === entry.entityId);
    if (!note) return null;
    return {
      entity: "note",
      kind: note.kind,
      status: note.status,
      blockId: note.anchor.blockId,
      label: note.anchor.label,
      replies: note.replies.length,
      lastAuthor: note.replies.at(-1)?.author.kind,
    };
  }

  /** `getEvents`, with each entry's entity summary attached. */
  getEnrichedEvents(sinceSeq: number): EnrichedJournalEntry[] {
    return this.getEvents(sinceSeq).map((entry) => ({
      ...entry,
      summary: this.describeEvent(entry),
    }));
  }

  /** Attaches summaries to a batch of raw entries (e.g. the result of `waitForActivity`). */
  enrichEvents(entries: JournalEntry[]): EnrichedJournalEntry[] {
    return entries.map((entry) => ({ ...entry, summary: this.describeEvent(entry) }));
  }

  /**
   * Resolves as soon as an entry with `seq > sinceSeq` exists, or with `[]` after
   * `timeoutMs` — a long-poll instead of a busy loop (mirrors impeccable's live-poll.mjs).
   */
  waitForActivity(sinceSeq: number, timeoutMs: number): Promise<JournalEntry[]> {
    const alreadyAvailable = this.getEvents(sinceSeq);
    return alreadyAvailable.length > 0
      ? Promise.resolve(alreadyAvailable)
      : new Promise((resolve) => {
          const waiter: Waiter = {
            sinceSeq,
            resolve: (entries) => {
              clearTimeout(timer);
              this.waiters = this.waiters.filter((item) => item !== waiter);
              resolve(entries);
            },
          };
          const timer = setTimeout(() => waiter.resolve([]), timeoutMs);
          this.waiters.push(waiter);
        });
  }

  private appendEvent(type: JournalEventType, entityId: string): void {
    const entry: JournalEntry = { seq: this.nextSeq++, ts: nowIso(), type, entityId };
    this.journal.push(entry);
    for (const waiter of this.waiters) {
      if (entry.seq > waiter.sinceSeq) {
        waiter.resolve(this.getEvents(waiter.sinceSeq));
      }
    }
  }
}

export const sessionStore = new SessionStore();
