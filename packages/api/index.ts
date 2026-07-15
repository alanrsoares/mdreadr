import { cors } from "@elysiajs/cors";
import { match } from "@onrails/pattern";
import { isErr } from "@onrails/result";
import { Elysia } from "elysia";
import { NOTES_SCHEMA_VERSION } from "../../shared/constants.ts";
import {
  addReply,
  createNote,
  findNote,
  type NotesDomainError,
  parseNotesFileJson,
  setNoteStatus,
} from "../domain/index.ts";
import {
  AddReplyBodySchema,
  CreateNoteBodySchema,
  LoadNotesBodySchema,
  NotesFileSchema,
  OpenDocumentBodySchema,
  PickFileBodySchema,
  SaveNotesBodySchema,
  UpdateNoteStatusBodySchema,
} from "../domain/schemas/index.ts";
import {
  openDocument,
  pickNativePath,
  readJsonFile,
  toDocumentHttpError,
  writeTextFile,
} from "./documents.ts";
import { readRecents, toRecentsHttpError } from "./recents.ts";
import { sessionStore } from "./session.ts";

function domainError(error: NotesDomainError): { error: string; code: string } {
  switch (error._tag) {
    case "InvalidNotesFile":
      return { error: error.message, code: error._tag };
    case "NoteNotFound":
      return { error: `Note not found: ${error.id}`, code: error._tag };
  }
}

export const app = new Elysia()
  .use(
    cors({
      origin: true,
      credentials: true,
    }),
  )
  .get("/health", () => ({ ok: true as const }))
  .get("/session", () => sessionStore.snapshot())
  .get("/documents/recent", async ({ set }) => {
    const result = await readRecents();
    if (isErr(result)) {
      set.status = 500;
      return toRecentsHttpError(result.error);
    }
    return { paths: result.value };
  })
  .post(
    "/documents/open",
    async ({ body, set }) => {
      const parsed = OpenDocumentBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const result = await openDocument(parsed.data.path);
      if (isErr(result)) {
        set.status = match(result.error._tag)
          .with("DocumentNotFound", () => 404)
          .with("DocumentReadFailed", () => 500)
          .exhaustive();
        return toDocumentHttpError(result.error);
      }

      sessionStore.setDocument({ path: result.value.path }, result.value.content);
      return {
        path: result.value.path,
        content: result.value.content,
      };
    },
    {
      body: OpenDocumentBodySchema,
    },
  )
  .get("/notes", () => ({ notes: sessionStore.getNotes() }))
  .post(
    "/notes",
    ({ body, set }) => {
      const parsed = CreateNoteBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const note = createNote(parsed.data);
      sessionStore.addNote(note);
      return { note };
    },
    { body: CreateNoteBodySchema },
  )
  .post(
    "/notes/:id/replies",
    ({ body, params, set }) => {
      const parsed = AddReplyBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const found = findNote(sessionStore.getNotes(), params.id);
      if (isErr(found)) {
        set.status = 404;
        return domainError(found.error);
      }

      const updated = addReply(found.value, parsed.data);
      sessionStore.replaceNote(updated);
      return { note: updated };
    },
    { body: AddReplyBodySchema },
  )
  .patch(
    "/notes/:id/status",
    ({ body, params, set }) => {
      const parsed = UpdateNoteStatusBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const found = findNote(sessionStore.getNotes(), params.id);
      if (isErr(found)) {
        set.status = 404;
        return domainError(found.error);
      }

      const updated = setNoteStatus(found.value, parsed.data.status);
      sessionStore.replaceNote(updated);
      return { note: updated };
    },
    { body: UpdateNoteStatusBodySchema },
  )
  .post(
    "/notes/save",
    async ({ body, set }) => {
      const parsed = SaveNotesBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const payload = NotesFileSchema.parse({
        schemaVersion: NOTES_SCHEMA_VERSION,
        document: parsed.data.document ?? sessionStore.snapshot().document ?? undefined,
        notes: parsed.data.notes,
      });

      const result = await writeTextFile(parsed.data.path, `${JSON.stringify(payload, null, 2)}\n`);

      if (isErr(result)) {
        set.status = 500;
        return { error: result.error.message, code: result.error._tag };
      }

      return { ok: true as const, path: parsed.data.path };
    },
    { body: SaveNotesBodySchema },
  )
  .post(
    "/notes/load",
    async ({ body, set }) => {
      const parsed = LoadNotesBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const raw = await readJsonFile(parsed.data.path);
      if (isErr(raw)) {
        set.status = 500;
        return { error: raw.error.message, code: raw.error._tag };
      }

      const notesFile = parseNotesFileJson(raw.value);
      if (isErr(notesFile)) {
        set.status = 400;
        return domainError(notesFile.error);
      }

      sessionStore.setNotes(notesFile.value.notes);
      if (notesFile.value.document) {
        const snapshot = sessionStore.snapshot();
        if (!snapshot.document || snapshot.document.path !== notesFile.value.document.path) {
          sessionStore.clearDocument();
        }
      }

      return {
        notes: notesFile.value.notes,
        document: notesFile.value.document,
      };
    },
    { body: LoadNotesBodySchema },
  )
  .post(
    "/dialogs/pick",
    async ({ body, set }) => {
      const parsed = PickFileBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const result = await pickNativePath(parsed.data);
      if (isErr(result)) {
        set.status = 500;
        return { error: result.error.message, code: result.error._tag };
      }

      return { path: result.value };
    },
    { body: PickFileBodySchema },
  );

export type App = typeof app;

export { sessionStore } from "./session.ts";

export function startServer(port = 0): { port: number; url: string } {
  const listener = app.listen({
    hostname: "127.0.0.1",
    port,
  });

  const address = listener.server?.port ?? port;
  return {
    port: address,
    url: `http://127.0.0.1:${address}`,
  };
}
