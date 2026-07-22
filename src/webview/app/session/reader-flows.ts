import type { DocumentRef, Note } from "@mdreadr/domain";
import type { ReaderApi } from "./reader-api.ts";

export type SaveNotesOutcome = { kind: "saved"; path: string } | { kind: "cancelled" };
export type LoadNotesOutcome =
  | { kind: "loaded"; documentPath: string | null }
  | { kind: "cancelled" };

export type SaveNotesFlowInput = { notes: Note[]; document?: DocumentRef };

/** Pick a target path (cancel → cancelled), then persist Session Notes as a Notes file. */
export async function saveNotesFlow(
  api: ReaderApi,
  input: SaveNotesFlowInput,
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
export const pickDocumentFlow = async (api: ReaderApi): Promise<string | null> =>
  api.pickPath({ mode: "open", filters: ["*.md"] });

export type SaveDroppedDocumentInput = { name: string; content: string };
export type SaveDroppedDocumentOutcome = { kind: "saved"; path: string } | { kind: "cancelled" };

/** Save As for content read client-side from a drag-drop the webview can't resolve a path for. */
export async function saveDroppedDocumentFlow(
  api: ReaderApi,
  input: SaveDroppedDocumentInput,
): Promise<SaveDroppedDocumentOutcome> {
  const path = await api.pickPath({ mode: "save", defaultPath: input.name, filters: ["*.md"] });
  if (!path) return { kind: "cancelled" };

  await api.createDocument(path, input.content);
  return { kind: "saved", path };
}
