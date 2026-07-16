import { homedir } from "node:os";
import type { DocumentRef, Note } from "../domain/index.ts";

export type SessionSnapshot = {
  document: DocumentRef | null;
  documentContent: string | null;
  notes: Note[];
  homeDirectory: string;
};

export class SessionStore {
  private document: DocumentRef | null = null;
  private documentContent: string | null = null;
  private notes: Note[] = [];
  private onDocumentChangeCallbacks: Array<(content: string) => void> = [];

  onDocumentChange(callback: (content: string) => void): void {
    this.onDocumentChangeCallbacks.push(callback);
  }

  triggerDocumentChange(content: string): void {
    for (const cb of this.onDocumentChangeCallbacks) {
      try {
        cb(content);
      } catch {}
    }
  }

  snapshot(): SessionSnapshot {
    return {
      document: this.document,
      documentContent: this.documentContent,
      notes: [...this.notes],
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
}

export const sessionStore = new SessionStore();
