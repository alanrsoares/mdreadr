import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionTokens } from "../../packages/api/auth.ts";
import { app, sessionStore, startServer } from "../../packages/api/index.ts";

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function post(url: string, path: string, body: unknown, token?: string) {
  return app.handle(
    new Request(`${url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }),
  );
}

function patch(url: string, path: string, body: unknown, token?: string) {
  return app.handle(
    new Request(`${url}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }),
  );
}

function get(url: string, path: string, token?: string) {
  return app.handle(new Request(`${url}${path}`, { headers: authHeaders(token) }));
}

describe("mdreadr api", () => {
  test("health and notes roundtrip", async () => {
    const { url } = startServer(0);
    sessionStore.setNotes([]);

    const health = await app.handle(new Request(`${url}/health`));
    expect(health?.status).toBe(200);

    const create = await app.handle(
      new Request(`${url}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anchor: { kind: "document", blockId: "document-root" },
          body: "Review this",
          author: { kind: "human" },
        }),
      }),
    );
    expect(create?.status).toBe(200);

    const notes = await app.handle(new Request(`${url}/notes`));
    const json = await notes?.json();
    expect(json.notes).toHaveLength(1);
  });

  describe("/documents/asset", () => {
    let dir: string;

    afterEach(async () => {
      sessionStore.clearDocument();
      if (dir) await rm(dir, { recursive: true, force: true });
    });

    test("403s when doc does not match the currently open document", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-asset-"));
      const docPath = join(dir, "doc.md");
      sessionStore.setDocument({ path: docPath }, "# Doc");

      const response = await app.handle(
        new Request(
          `${url}/documents/asset?doc=${encodeURIComponent(join(dir, "other.md"))}&src=hero.png`,
        ),
      );

      expect(response?.status).toBe(403);
    });

    test("200s when the asset exists next to the open document", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-asset-"));
      const docPath = join(dir, "doc.md");
      await writeFile(join(dir, "hero.png"), "fake-image-bytes");
      sessionStore.setDocument({ path: docPath }, "# Doc");

      const response = await app.handle(
        new Request(`${url}/documents/asset?doc=${encodeURIComponent(docPath)}&src=hero.png`),
      );

      expect(response?.status).toBe(200);
    });

    test("404s when the asset is missing", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-asset-"));
      const docPath = join(dir, "doc.md");
      sessionStore.setDocument({ path: docPath }, "# Doc");

      const response = await app.handle(
        new Request(`${url}/documents/asset?doc=${encodeURIComponent(docPath)}&src=missing.png`),
      );

      expect(response?.status).toBe(404);
    });
  });

  describe("/documents/save", () => {
    let dir: string;

    afterEach(async () => {
      sessionStore.clearDocument();
      if (dir) await rm(dir, { recursive: true, force: true });
    });

    test("401s without the webview token", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-save-"));
      const docPath = join(dir, "doc.md");

      const response = await post(url, "/documents/save", { path: docPath, content: "new" });

      expect(response?.status).toBe(401);
    });

    test("403s with nothing open", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-save-"));
      const docPath = join(dir, "doc.md");

      const response = await post(
        url,
        "/documents/save",
        { path: docPath, content: "new" },
        sessionTokens.webviewToken,
      );

      expect(response?.status).toBe(403);
      const json = await response?.json();
      expect(json.code).toBe("DocumentNotOpen");
    });

    test("saves the open document and updates the session", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-save-"));
      const docPath = join(dir, "doc.md");
      await writeFile(docPath, "original");

      const open = await post(url, "/documents/open", { path: docPath });
      expect(open?.status).toBe(200);

      const response = await post(
        url,
        "/documents/save",
        { path: docPath, content: "updated" },
        sessionTokens.webviewToken,
      );
      expect(response?.status).toBe(200);
      const json = await response?.json();
      expect(json.path).toBe(docPath);

      const onDisk = await Bun.file(docPath).text();
      expect(onDisk).toBe("updated");

      const session = await app.handle(new Request(`${url}/session`));
      const sessionJson = await session?.json();
      expect(sessionJson.documentContent).toBe("updated");
    });

    test("400s on an invalid body", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-save-"));
      const docPath = join(dir, "doc.md");
      await writeFile(docPath, "original");
      await post(url, "/documents/open", { path: docPath });

      const response = await post(
        url,
        "/documents/save",
        { path: docPath },
        sessionTokens.webviewToken,
      );

      expect(response?.status).toBe(400);
      const json = await response?.json();
      expect(json.code).toBe("ValidationError");
    });
  });

  describe("/notes/save + /notes/load", () => {
    let dir: string;

    afterEach(async () => {
      if (dir) await rm(dir, { recursive: true, force: true });
    });

    test("round-trips notes through a saved file", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-notes-"));
      const notesPath = join(dir, "notes.json");
      const notes = [
        {
          id: "note-1",
          anchor: { kind: "document" as const, blockId: "doc" },
          kind: "comment" as const,
          status: "open" as const,
          replies: [
            {
              id: "reply-1",
              author: { kind: "human" as const },
              body: "hi",
              createdAt: "2024-01-01T00:00:00.000Z",
            },
          ],
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ];

      const save = await post(url, "/notes/save", { path: notesPath, notes });
      expect(save?.status).toBe(200);

      const load = await post(url, "/notes/load", { path: notesPath }, sessionTokens.webviewToken);
      expect(load?.status).toBe(200);
      const json = await load?.json();
      expect(json.notes).toEqual(notes);
    });

    test("rejects a notes file with an unsupported schemaVersion", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-notes-"));
      const notesPath = join(dir, "bad-notes.json");
      await writeFile(
        notesPath,
        JSON.stringify({ schemaVersion: 2, notes: [] satisfies unknown[] }),
      );

      const load = await post(url, "/notes/load", { path: notesPath }, sessionTokens.webviewToken);

      expect(load?.status).toBe(400);
      const json = await load?.json();
      expect(json.code).toBe("InvalidNotesFile");
    });

    test("401s without the webview token", async () => {
      const { url } = startServer(0);
      dir = await mkdtemp(join(tmpdir(), "mdreadr-notes-"));
      const notesPath = join(dir, "notes.json");
      await writeFile(notesPath, JSON.stringify({ schemaVersion: 1, notes: [] }));

      const load = await post(url, "/notes/load", { path: notesPath });

      expect(load?.status).toBe(401);
    });
  });

  describe("/notes/:id/replies and /notes/:id/status", () => {
    afterEach(() => {
      sessionStore.setNotes([]);
    });

    test("adds a reply on the happy path and 404s for an unknown note", async () => {
      const { url } = startServer(0);
      sessionStore.setNotes([]);

      const create = await post(url, "/notes", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "Review this",
        author: { kind: "human" },
      });
      const created = await create?.json();
      expect(created.note.replies).toHaveLength(1);

      const reply = await post(url, `/notes/${created.note.id}/replies`, {
        body: "Following up",
        author: { kind: "human" },
      });
      expect(reply?.status).toBe(200);
      const replyJson = await reply?.json();
      expect(replyJson.note.replies).toHaveLength(2);

      const missing = await post(url, "/notes/does-not-exist/replies", {
        body: "Following up",
        author: { kind: "human" },
      });
      expect(missing?.status).toBe(404);
    });

    test("updates status on the happy path and 404s for an unknown note", async () => {
      const { url } = startServer(0);
      sessionStore.setNotes([]);

      const create = await post(url, "/notes", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "Review this",
        author: { kind: "human" },
      });
      const created = await create?.json();

      const update = await app.handle(
        new Request(`${url}/notes/${created.note.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "resolved" }),
        }),
      );
      expect(update?.status).toBe(200);
      const updateJson = await update?.json();
      expect(updateJson.note.status).toBe("resolved");

      const missing = await app.handle(
        new Request(`${url}/notes/does-not-exist/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "resolved" }),
        }),
      );
      expect(missing?.status).toBe(404);
    });
  });

  describe("/suggestions", () => {
    afterEach(() => {
      sessionStore.setSuggestions([]);
      sessionStore.clearDocument();
    });

    test("401s without either token", async () => {
      const { url } = startServer(0);

      const listResponse = await get(url, "/suggestions");
      expect(listResponse?.status).toBe(401);

      const createResponse = await post(url, "/suggestions", {
        anchor: { kind: "document", blockId: "document-root" },
        replacementText: "new text",
        author: { kind: "agent" },
      });
      expect(createResponse?.status).toBe(401);
    });

    test("creates, lists, and rejects a suggestion with either token", async () => {
      const { url } = startServer(0);

      const create = await post(
        url,
        "/suggestions",
        {
          anchor: { kind: "document", blockId: "document-root" },
          replacementText: "new text",
          author: { kind: "agent" },
        },
        sessionTokens.agentToken,
      );
      expect(create?.status).toBe(200);
      const created = await create?.json();
      expect(created.suggestion.status).toBe("pending");

      const list = await get(url, "/suggestions", sessionTokens.webviewToken);
      expect(list?.status).toBe(200);
      const listed = await list?.json();
      expect(listed.suggestions).toHaveLength(1);

      const reject = await patch(
        url,
        `/suggestions/${created.suggestion.id}/status`,
        { status: "rejected" },
        sessionTokens.webviewToken,
      );
      expect(reject?.status).toBe(200);
      const rejected = await reject?.json();
      expect(rejected.suggestion.status).toBe("rejected");
    });

    test("404s on an unknown suggestion id", async () => {
      const { url } = startServer(0);

      const response = await patch(
        url,
        "/suggestions/does-not-exist/status",
        { status: "accepted" },
        sessionTokens.webviewToken,
      );

      expect(response?.status).toBe(404);
    });

    test("403s accepting a suggestion with no Document open", async () => {
      const { url } = startServer(0);
      sessionStore.clearDocument();

      const create = await post(
        url,
        "/suggestions",
        {
          anchor: { kind: "document", blockId: "document-root" },
          replacementText: "new text",
          author: { kind: "agent" },
        },
        sessionTokens.agentToken,
      );
      const created = await create?.json();

      const accept = await patch(
        url,
        `/suggestions/${created.suggestion.id}/status`,
        { status: "accepted" },
        sessionTokens.webviewToken,
      );

      expect(accept?.status).toBe(403);
      const json = await accept?.json();
      expect(json.code).toBe("DocumentNotOpen");
    });

    test("auto-completes an accepted suggestion once its replacement lands on save", async () => {
      const { url } = startServer(0);
      const dir = await mkdtemp(join(tmpdir(), "mdreadr-suggestions-"));
      const docPath = join(dir, "doc.md");
      await writeFile(docPath, "# Title\n\noriginal body\n");

      try {
        await post(url, "/documents/open", { path: docPath });

        const create = await post(
          url,
          "/suggestions",
          {
            anchor: { kind: "document", blockId: "document-root" },
            replacementText: "# Title\n\nupdated body\n",
            author: { kind: "agent" },
          },
          sessionTokens.agentToken,
        );
        const created = await create?.json();

        await patch(
          url,
          `/suggestions/${created.suggestion.id}/status`,
          { status: "accepted" },
          sessionTokens.webviewToken,
        );

        const save = await post(
          url,
          "/documents/save",
          { path: docPath, content: "# Title\n\nupdated body\n" },
          sessionTokens.webviewToken,
        );
        expect(save?.status).toBe(200);

        const list = await get(url, "/suggestions", sessionTokens.webviewToken);
        const listed = await list?.json();
        expect(listed.suggestions[0].status).toBe("completed");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe("/mcp/clients", () => {
    test("401s without the webview token", async () => {
      const { url } = startServer(0);

      const response = await get(url, "/mcp/clients");

      expect(response?.status).toBe(401);
    });

    test("reports the connected client list with the webview token", async () => {
      const { url } = startServer(0);

      const response = await get(url, "/mcp/clients", sessionTokens.webviewToken);

      expect(response?.status).toBe(200);
      const json = await response?.json();
      expect(Array.isArray(json.clients)).toBe(true);
      expect(json.count).toBe(json.clients.length);
    });
  });
});
