import { homedir } from "node:os";
import type { DocumentRef, Note, Suggestion } from "../domain/index.ts";

export type SessionSnapshot = {
  document: DocumentRef | null;
  documentContent: string | null;
  notes: Note[];
  suggestions: Suggestion[];
  homeDirectory: string;
};

export class SessionStore {
  private document: DocumentRef | null = null;
  private documentContent: string | null = null;
  private notes: Note[] = [];
  private suggestions: Suggestion[] = [];

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
  }

  getSuggestions(): Suggestion[] {
    return [...this.suggestions];
  }

  setSuggestions(suggestions: Suggestion[]): void {
    this.suggestions = [...suggestions];
  }

  addSuggestion(suggestion: Suggestion): void {
    this.suggestions = [...this.suggestions, suggestion];
  }

  replaceSuggestion(suggestion: Suggestion): void {
    this.suggestions = this.suggestions.map((item) =>
      item.id === suggestion.id ? suggestion : item,
    );
  }
}

export const sessionStore = new SessionStore();
