import type { DocumentRef, Note } from "@mdreadr/domain";
import type { ReaderApi } from "./reader-api.ts";

export type SaveNotesOutcome = { kind: "saved"; path: string } | { kind: "cancelled" };
export type LoadNotesOutcome =
  | { kind: "loaded"; documentPath: string | null }
  | { kind: "cancelled" };

/** Pick a target path (cancel → cancelled), then persist Session Notes as a Notes file. */
export async function saveNotesFlow(
  api: ReaderApi,
  input: { notes: Note[]; document?: DocumentRef },
): Promise<SaveNotesOutcome> {
  const path = await api.pickPath({ mode: "save", defaultPath: "notes.json" });
  if (!path) return { kind: "cancelled" };

  await api.saveNotes({ path, notes: input.notes, document: input.document });
  return { kind: "saved", path };
}

/** Pick a Notes file (cancel → cancelled), load it, report the Document to reopen (if any). */
export async function loadNotesFlow(api: ReaderApi): Promise<LoadNotesOutcome> {
  const path = await api.pickPath({ mode: "open", filters: ["*.json"] });
  if (!path) return { kind: "cancelled" };

  const result = await api.loadNotes(path);
  return { kind: "loaded", documentPath: result.document?.path ?? null };
}

/** Pick a Document (cancel → null). */
export async function pickDocumentFlow(api: ReaderApi): Promise<string | null> {
  return api.pickPath({ mode: "open", filters: ["*.md"] });
}
