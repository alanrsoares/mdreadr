import { homedir } from "node:os";
import type { DocumentRef, Note, Suggestion } from "../domain/index.ts";
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
   * Resolves as soon as an entry with `seq > sinceSeq` exists, or with `[]` after
   * `timeoutMs` — a long-poll instead of a busy loop (mirrors impeccable's live-poll.mjs).
   */
  waitForActivity(sinceSeq: number, timeoutMs: number): Promise<JournalEntry[]> {
    const alreadyAvailable = this.getEvents(sinceSeq);
    if (alreadyAvailable.length > 0) {
      return Promise.resolve(alreadyAvailable);
    }

    return new Promise((resolve) => {
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
