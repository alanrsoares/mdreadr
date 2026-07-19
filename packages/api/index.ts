import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { cors } from "@elysiajs/cors";
import { match } from "@onrails/pattern";
import { isErr } from "@onrails/result";
import { Elysia } from "elysia";
import { NOTES_SCHEMA_VERSION } from "../../shared/constants.ts";
import {
  addReply,
  createNote,
  createSuggestion,
  findNote,
  findSuggestion,
  type NotesDomainError,
  parseNotesFileJson,
  resolveBlockText,
  type SuggestionDomainError,
  setNoteStatus,
  setSuggestionStatus,
} from "../domain/index.ts";
import {
  AddReplyBodySchema,
  CreateNoteBodySchema,
  CreateSuggestionBodySchema,
  LoadNotesBodySchema,
  NotesFileSchema,
  OpenDocumentBodySchema,
  PickFileBodySchema,
  SaveDocumentBodySchema,
  SaveNotesBodySchema,
  UpdateNoteStatusBodySchema,
  UpdateSuggestionStatusBodySchema,
} from "../domain/schemas/index.ts";
import { isAgentAuthorized, isWebviewAuthorized, revokeAgentToken, sessionTokens } from "./auth.ts";
import { documentSession } from "./document-session.ts";
import {
  pickNativePath,
  readJsonFile,
  resolveAssetPath,
  toDocumentHttpError,
  writeTextFile,
} from "./documents.ts";
import { getConnectedClients, handleMcpRequest } from "./mcp.ts";
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

function suggestionDomainError(error: SuggestionDomainError): { error: string; code: string } {
  return { error: `Suggestion not found: ${error.id}`, code: error._tag };
}

const unauthorized = { error: "Unauthorized", code: "Unauthorized" } as const;

/** Only the webview may write to disk or read arbitrary paths (/documents/save, /notes/load). */
function isWebviewRequest(request: Request): boolean {
  return isWebviewAuthorized(request);
}

/** Only the MCP transport entry points require the agent token. */
function isAgentRequest(request: Request): boolean {
  return isAgentAuthorized(request);
}

/** Suggestions are read/actioned by the webview and proposed by the agent — either token works. */
function isAgentOrWebviewRequest(request: Request): boolean {
  return isAgentAuthorized(request) || isWebviewAuthorized(request);
}

export const app = new Elysia()
  .use(
    cors({
      origin: true,
      credentials: true,
    }),
  )
  .get("/health", () => ({ ok: true as const }))
  .post("/log", ({ body }) => {
    const msg = (body as { message: string })?.message;
    console.log(`[webview-log] ${msg}`);
    try {
      require("node:fs").appendFileSync(
        "/tmp/mdreadr-webview.log",
        `[${new Date().toISOString()}] ${msg}\n`,
      );
    } catch {}
    return { ok: true };
  })
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

      const result = await documentSession.open(parsed.data.path);
      if (isErr(result)) {
        set.status = match(result.error._tag)
          .with("DocumentNotFound", () => 404)
          .with("DocumentReadFailed", () => 500)
          .exhaustive();
        return toDocumentHttpError(result.error);
      }

      return {
        path: result.value.path,
        content: result.value.content,
      };
    },
    {
      body: OpenDocumentBodySchema,
    },
  )
  // Serves images referenced relative to the currently open Document. Scoped
  // to that Document so the endpoint cannot be used to probe arbitrary paths.
  .get("/documents/asset", async ({ query, set }) => {
    const { doc, src } = query;
    if (
      typeof doc !== "string" ||
      doc.length === 0 ||
      typeof src !== "string" ||
      src.length === 0
    ) {
      set.status = 400;
      return { error: "doc and src query params are required", code: "ValidationError" };
    }

    if (!documentSession.isAssetAllowed(doc)) {
      set.status = 403;
      return { error: "Asset requests must reference the open Document", code: "AssetForbidden" };
    }

    const file = Bun.file(resolveAssetPath(doc, src));
    if (!(await file.exists())) {
      set.status = 404;
      return { error: `Asset not found: ${src}`, code: "AssetNotFound" };
    }

    return file;
  })
  .post(
    "/documents/save",
    async ({ body, request, set }) => {
      if (!isWebviewRequest(request)) {
        set.status = 401;
        return unauthorized;
      }

      const parsed = SaveDocumentBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const result = await documentSession.save(parsed.data.path, parsed.data.content);
      if (isErr(result)) {
        return match(result.error)
          .with({ _tag: "DocumentNotOpen" }, () => {
            set.status = 403;
            return { error: "Only the open Document can be saved", code: "DocumentNotOpen" };
          })
          .with({ _tag: "WriteFailed" }, (error) => {
            set.status = 500;
            return { error: error.message, code: "WriteFailed" };
          })
          .exhaustive();
      }

      // A Suggestion accepted into the Draft only becomes "completed" once its
      // replacementText has actually landed on disk at its anchor.
      for (const suggestion of sessionStore.getSuggestions()) {
        if (suggestion.status !== "accepted") continue;
        const resolved = resolveBlockText(parsed.data.content, suggestion.anchor);
        if (resolved === suggestion.replacementText) {
          sessionStore.suggestionStatusChanged(setSuggestionStatus(suggestion, "completed"));
        }
      }

      return { path: parsed.data.path };
    },
    // No route-level `body` schema here: Elysia validates a declared body
    // schema before the handler runs and returns its own 422 on failure,
    // preempting the manual `safeParse` 400/ValidationError path below (a
    // pre-existing quirk shared by every schema-guarded route in this file,
    // just never exercised by a test until this one). Parsing manually
    // inside the handler is what actually produces the intended 400 here.
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
      sessionStore.noteReplied(updated);
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
      sessionStore.noteStatusChanged(updated);
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
    async ({ body, request, set }) => {
      if (!isWebviewRequest(request)) {
        set.status = 401;
        return unauthorized;
      }

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
  .get("/suggestions", ({ request, set }) => {
    if (!isAgentOrWebviewRequest(request)) {
      set.status = 401;
      return unauthorized;
    }
    return { suggestions: sessionStore.getSuggestions() };
  })
  .post(
    "/suggestions",
    ({ body, request, set }) => {
      if (!isAgentOrWebviewRequest(request)) {
        set.status = 401;
        return unauthorized;
      }

      const parsed = CreateSuggestionBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const suggestion = createSuggestion(parsed.data);
      sessionStore.addSuggestion(suggestion);
      return { suggestion };
    },
    { body: CreateSuggestionBodySchema },
  )
  .patch(
    "/suggestions/:id/status",
    ({ body, params, request, set }) => {
      if (!isAgentOrWebviewRequest(request)) {
        set.status = 401;
        return unauthorized;
      }

      const parsed = UpdateSuggestionStatusBodySchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.message, code: "ValidationError" };
      }

      const found = findSuggestion(sessionStore.getSuggestions(), params.id);
      if (isErr(found)) {
        set.status = 404;
        return suggestionDomainError(found.error);
      }

      if (parsed.data.status === "accepted" && !sessionStore.snapshot().document) {
        set.status = 403;
        return { error: "No Document is open", code: "DocumentNotOpen" };
      }

      const updated = setSuggestionStatus(found.value, parsed.data.status);
      sessionStore.suggestionStatusChanged(updated);
      return { suggestion: updated };
    },
    { body: UpdateSuggestionStatusBodySchema },
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
  )
  .get("/mcp/connection", ({ request, set }) => {
    if (!isWebviewRequest(request)) {
      set.status = 401;
      return unauthorized;
    }
    return {
      url: `${new URL(request.url).origin}/mcp`,
      token: sessionTokens.agentToken,
    };
  })
  .get("/mcp/clients", ({ request, set }) => {
    if (!isWebviewRequest(request)) {
      set.status = 401;
      return unauthorized;
    }
    const clients = getConnectedClients();
    return { clients, count: clients.length };
  })
  .post("/mcp/connection/revoke", async ({ request, set }) => {
    if (!isWebviewRequest(request)) {
      set.status = 401;
      return unauthorized;
    }
    const origin = new URL(request.url).origin;
    const token = await revokeAgentToken();
    await writeMcpConfigFile(origin);
    return { url: `${origin}/mcp`, token };
  })
  .all("/mcp", async ({ request }) => {
    if (!isAgentRequest(request)) {
      return new Response(JSON.stringify(unauthorized), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return handleMcpRequest(request);
  })
  .all("/mcp/message", async ({ request }) => {
    if (!isAgentRequest(request)) {
      return new Response(JSON.stringify(unauthorized), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return handleMcpRequest(request);
  });

export type App = typeof app;

export { documentSession } from "./document-session.ts";
export { sessionStore } from "./session.ts";

// Stable so MCP client configs (URL + persisted agent token, see auth.ts)
// keep working across restarts without the user having to reconfigure them.
// Falls back to a random port if something else is already bound to it.
const DEFAULT_PORT = Number(process.env.MDREADR_PORT) || 47813;

async function writeMcpConfigFile(origin: string): Promise<void> {
  try {
    const configDir = join(homedir(), ".config", "mdreadr");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "mcp.json"),
      JSON.stringify(
        {
          mcpServers: {
            mdreadr: { url: `${origin}/mcp`, token: sessionTokens.agentToken },
          },
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error("Failed to write mcp.json", e);
  }
}

export function startServer(port = DEFAULT_PORT): {
  port: number;
  url: string;
  webviewToken: string;
} {
  let listener: ReturnType<typeof app.listen>;
  try {
    listener = app.listen({ hostname: "127.0.0.1", port });
  } catch (e) {
    if (port === 0) throw e;
    console.error(`Port ${port} unavailable, falling back to a random port`, e);
    listener = app.listen({ hostname: "127.0.0.1", port: 0 });
  }

  const address = listener.server?.port ?? port;
  const url = `http://127.0.0.1:${address}`;

  // Write MCP discovery config for the stdio proxy / external tooling.
  // The webview token is deliberately never written to disk — see auth.ts.
  void writeMcpConfigFile(url);

  return {
    port: address,
    url,
    webviewToken: sessionTokens.webviewToken,
  };
}
