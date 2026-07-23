import { homedir } from "node:os";
import { resolve } from "node:path";
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
  /** Which document was active when this fired; `null` for the no-document bucket. */
  documentId: string | null;
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

export type TabSummary = { id: string; document: DocumentRef };

type Waiter = {
  sinceSeq: number;
  resolve: (entries: JournalEntry[]) => void;
};

type DocumentEntry = {
  id: string;
  document: DocumentRef;
  documentContent: string;
  notes: Note[];
  suggestions: Suggestion[];
};

type NoteSuggestionBucket = { notes: Note[]; suggestions: Suggestion[] };

export class SessionStore {
  private tabs = new Map<string, DocumentEntry>();
  private activeId: string | null = null;
  /** Notes/suggestions created while no document is open — same bucket the app has
   * always used for this case, now just one of several instead of the only one. */
  private noDocNotes: Note[] = [];
  private noDocSuggestions: Suggestion[] = [];
  private journal: JournalEntry[] = [];
  private nextSeq = 1;
  private waiters: Waiter[] = [];

  static normalizeDocumentId(path: string): string {
    return resolve(path);
  }

  private activeEntry(): DocumentEntry | undefined {
    return this.activeId ? this.tabs.get(this.activeId) : undefined;
  }

  private bucketFor(documentId: string | null): NoteSuggestionBucket {
    if (documentId === null) return { notes: this.noDocNotes, suggestions: this.noDocSuggestions };
    return this.tabs.get(documentId) ?? { notes: [], suggestions: [] };
  }

  private get notes(): Note[] {
    return this.activeEntry()?.notes ?? this.noDocNotes;
  }

  private set notes(value: Note[]) {
    const entry = this.activeEntry();
    if (entry) entry.notes = value;
    else this.noDocNotes = value;
  }

  private get suggestions(): Suggestion[] {
    return this.activeEntry()?.suggestions ?? this.noDocSuggestions;
  }

  private set suggestions(value: Suggestion[]) {
    const entry = this.activeEntry();
    if (entry) entry.suggestions = value;
    else this.noDocSuggestions = value;
  }

  snapshot(): SessionSnapshot {
    const entry = this.activeEntry();
    return {
      document: entry?.document ?? null,
      documentContent: entry?.documentContent ?? null,
      notes: [...this.notes],
      suggestions: [...this.suggestions],
      homeDirectory: process.env.HOME ?? homedir(),
    };
  }

  /** Back-compat single-document API: opens (or refreshes) `document`'s tab and activates it. */
  setDocument(document: DocumentRef, content: string): void {
    this.openTab(SessionStore.normalizeDocumentId(document.path), document, content);
  }

  /** Back-compat single-document API: deactivates the current tab without closing it. */
  clearDocument(): void {
    this.activeId = null;
  }

  /** Upserts a tab for `id` and makes it active. Reopening an already-open id keeps its notes/suggestions. */
  openTab(id: string, document: DocumentRef, content: string): void {
    const existing = this.tabs.get(id);
    if (existing) {
      existing.document = document;
      existing.documentContent = content;
    } else {
      this.tabs.set(id, { id, document, documentContent: content, notes: [], suggestions: [] });
    }
    this.activeId = id;
  }

  activateTab(id: string): void {
    if (this.tabs.has(id)) this.activeId = id;
  }

  /** Closes a tab, falling back to another open tab (or the no-document bucket) if it was active. */
  closeTab(id: string): void {
    this.tabs.delete(id);
    if (this.activeId !== id) return;
    const next = this.tabs.keys().next();
    this.activeId = next.done ? null : next.value;
  }

  listTabs(): TabSummary[] {
    return [...this.tabs.values()].map(({ id, document }) => ({ id, document }));
  }

  get activeTabId(): string | null {
    return this.activeId;
  }

  /** Closes every open tab and wipes the no-document bucket too — a true blank slate. */
  resetAllTabs(): void {
    this.tabs.clear();
    this.activeId = null;
    this.noDocNotes = [];
    this.noDocSuggestions = [];
  }

  getTabContent(id: string): string | undefined {
    return this.tabs.get(id)?.documentContent;
  }

  /**
   * Updates a tab's content if it differs from what's stored, without changing
   * which tab is active — a background tab's file can change without stealing focus.
   * Returns whether anything changed.
   */
  updateTabContentIfChanged(id: string, content: string): boolean {
    const entry = this.tabs.get(id);
    if (!entry || entry.documentContent === content) return false;
    entry.documentContent = content;
    return true;
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

  /** Journal entries with `seq > sinceSeq` for the active document, oldest first. */
  getEvents(sinceSeq: number): JournalEntry[] {
    return this.journal.filter(
      (entry) => entry.seq > sinceSeq && entry.documentId === this.activeId,
    );
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
    const bucket = this.bucketFor(entry.documentId);
    if (entry.type.startsWith("suggestion_")) {
      const suggestion = bucket.suggestions.find((item) => item.id === entry.entityId);
      if (!suggestion) return null;
      return {
        entity: "suggestion",
        status: suggestion.status,
        blockId: suggestion.anchor.blockId,
        noteId: suggestion.noteId,
        author: suggestion.author.kind,
      };
    }
    const note = bucket.notes.find((item) => item.id === entry.entityId);
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
   * Resolves as soon as an entry with `seq > sinceSeq` exists for the active document,
   * or with `[]` after `timeoutMs` — a long-poll instead of a busy loop (mirrors
   * impeccable's live-poll.mjs).
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
    const entry: JournalEntry = {
      seq: this.nextSeq++,
      ts: nowIso(),
      type,
      entityId,
      documentId: this.activeId,
    };
    this.journal.push(entry);
    for (const waiter of this.waiters) {
      if (entry.seq > waiter.sinceSeq && entry.documentId === this.activeId) {
        waiter.resolve(this.getEvents(waiter.sinceSeq));
      }
    }
  }
}

export const sessionStore = new SessionStore();
