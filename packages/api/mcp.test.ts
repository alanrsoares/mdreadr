import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionTokens } from "./auth.ts";
import { app } from "./index.ts";
import { sessionStore } from "./session.ts";

async function parseMcpResponse(response: Response) {
  const text = await response.text();
  if (text.startsWith("event: ") || text.includes("\ndata: ") || text.startsWith("data: ")) {
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    if (dataLine) {
      return JSON.parse(dataLine.slice(6));
    }
  }
  return JSON.parse(text);
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const response = await app.handle(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${sessionTokens.agentToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
  );
  const data = await parseMcpResponse(response);
  if (data.error) {
    return { isError: true, content: [{ text: data.error.message || JSON.stringify(data.error) }] };
  }
  if (data.result?.isError) {
    return { isError: true, content: data.result.content };
  }
  const first = data.result?.content?.[0];
  if (!first) throw new Error("expected tool result content");
  try {
    return JSON.parse(first.text);
  } catch {
    return first.text;
  }
}

async function listTools() {
  const response = await app.handle(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${sessionTokens.agentToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    }),
  );
  const data = await parseMcpResponse(response);
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result.tools as Array<{ name: string; inputSchema: Record<string, unknown> }>;
}

describe("MCP Server", () => {
  beforeEach(() => {
    sessionStore.resetAllTabs();
  });

  it("exposes /mcp POST endpoint for initialization", async () => {
    const response = await app.handle(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${sessionTokens.agentToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
  });

  it("handles initialization when client sends Accept: application/json without text/event-stream", async () => {
    const response = await app.handle(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${sessionTokens.agentToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("gives concurrent initialize calls independent, non-clobbered sessions", async () => {
    const initialize = (id: number) =>
      app.handle(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            Authorization: `Bearer ${sessionTokens.agentToken}`,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: `test-${id}`, version: "1.0.0" },
            },
          }),
        }),
      );

    const [responseA, responseB] = await Promise.all([initialize(1), initialize(2)]);
    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    const sessionIdA = responseA.headers.get("mcp-session-id");
    const sessionIdB = responseB.headers.get("mcp-session-id");

    const listSessionTools = (sessionId?: string | null) =>
      app.handle(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            Authorization: `Bearer ${sessionTokens.agentToken}`,
            ...(sessionId ? { "mcp-session-id": sessionId } : {}),
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} }),
        }),
      );

    const [listA, listB] = await Promise.all([
      listSessionTools(sessionIdA),
      listSessionTools(sessionIdB),
    ]);
    expect(listA.status).toBe(200);
    expect(listB.status).toBe(200);
  });

  it("401s /mcp without the agent token", async () => {
    const response = await app.handle(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("registers tools correctly", async () => {
    const { mcpServer } = await import("./mcp/index.ts");
    expect(mcpServer).toBeDefined();
  });

  it("exposes typed author and anchor schemas, plus the block-read tool", async () => {
    const tools = await listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

    function findTool(name: string) {
      const tool = byName[name];
      if (!tool) throw new Error(`Tool not found: ${name}`);
      return tool;
    }

    // biome-ignore lint/suspicious/noExplicitAny: reaching into hand-authored JSON Schema shapes for assertions
    const props = (schema: Record<string, unknown>) => schema.properties as any;

    expect(props(findTool("add_note").inputSchema).author.properties.kind.enum).toEqual([
      "human",
      "agent",
      "system",
    ]);
    expect(props(findTool("add_reply").inputSchema).author.properties.kind.enum).toEqual([
      "human",
      "agent",
      "system",
    ]);
    expect(props(findTool("add_note").inputSchema).anchor.properties.kind.enum).toEqual([
      "document",
      "heading",
      "paragraph",
      "code",
    ]);

    expect(props(findTool("get_document_block").inputSchema).anchor.properties.blockId.type).toBe(
      "string",
    );

    expect(findTool("propose_edit").inputSchema.required).toEqual(["anchor", "replacementText"]);
    expect(byName.run_script).toBeDefined();
  });

  it("propose_edit adds a pending Suggestion to the session", async () => {
    const suggestion = await callTool("propose_edit", {
      anchor: { kind: "document", blockId: "document-root" },
      replacementText: "new text",
    });

    expect(suggestion.status).toBe("pending");
    expect(suggestion.author).toEqual({ kind: "agent" });
    expect(sessionStore.getSuggestions()).toHaveLength(1);
  });

  describe("journal / wait_for_activity", () => {
    type SeqEvent = { seq: number };

    async function currentMaxSeq() {
      const { events } = await callTool("wait_for_activity", { sinceSeq: 0, timeoutMs: 0 });
      return (
        events.reduce((max: number, e: SeqEvent) => Math.max(max, e.seq), 0) ??
        sessionStore.latestSeq()
      );
    }

    it("wait_for_activity returns immediately when activity already happened", async () => {
      const sinceSeq = await currentMaxSeq();

      const added = await callTool("add_note", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "hello",
        author: { kind: "agent" },
      });

      const { events, latestSeq } = await callTool("wait_for_activity", {
        sinceSeq,
        timeoutMs: 0,
      });

      expect(events).toHaveLength(1);
      expect(events[0].entityId).toBe(added.id);
      expect(latestSeq).toBeGreaterThan(sinceSeq);
    });

    it("wait_for_activity resolves empty when timeout passes with no activity", async () => {
      const sinceSeq = await currentMaxSeq();
      const start = Date.now();

      const { events } = await callTool("wait_for_activity", {
        sinceSeq,
        timeoutMs: 50,
      });

      expect(events).toEqual([]);
      expect(Date.now() - start).toBeGreaterThanOrEqual(40);
    });

    it("wait_for_activity wakes when a note is added mid-wait", async () => {
      const sinceSeq = await currentMaxSeq();

      const waitPromise = callTool("wait_for_activity", { sinceSeq, timeoutMs: 5000 });

      await new Promise((r) => setTimeout(r, 20));
      const added = await callTool("add_note", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "waking note",
        author: { kind: "agent" },
      });

      const { events } = await waitPromise;
      expect(events).toHaveLength(1);
      expect(events[0].entityId).toBe(added.id);
    });

    it("get_events is a non-blocking catch-up read", async () => {
      const sinceSeq = await currentMaxSeq();
      const added = await callTool("add_note", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "hello",
        author: { kind: "agent" },
      });
      const events = await callTool("get_events", { sinceSeq });
      expect(events.events).toHaveLength(1);
      expect(events.events[0].entityId).toBe(added.id);
    });
  });

  describe("compact note payloads", () => {
    it("add_note returns a terse ack and get_session_notes returns summaries", async () => {
      const added = await callTool("add_note", {
        anchor: { kind: "document", blockId: "document-root", label: "whole doc" },
        body: "x".repeat(200),
        author: { kind: "human" },
        kind: "request",
      });
      expect(added.id).toBeTruthy();
      expect(added.replies).toBeUndefined();

      const { notes } = await callTool("get_session_notes", {});
      expect(notes).toHaveLength(1);
      expect(notes[0].anchor).toBe("whole doc");
      expect(notes[0].replies).toBe(1);
      expect(notes[0].lastReply.preview.endsWith("…")).toBe(true);
      expect(notes[0].lastReply.preview.length).toBe(141);

      const verbose = await callTool("get_session_notes", { verbose: true });
      expect(verbose.notes[0].replies[0].body).toHaveLength(200);
    });

    it("get_note returns the full thread and add_reply returns a terse ack", async () => {
      const added = await callTool("add_note", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "hello",
        author: { kind: "human" },
      });

      const ack = await callTool("add_reply", {
        noteId: added.id,
        body: "a reply",
        author: { kind: "agent" },
      });
      expect(ack).toEqual({
        noteId: added.id,
        replyId: expect.any(String),
        replies: 2,
        updatedAt: expect.any(String),
      });

      const note = await callTool("get_note", { noteId: added.id });
      expect(note.replies).toHaveLength(2);
      expect(note.replies[1].body).toBe("a reply");
    });

    it("set_note_status returns a terse ack", async () => {
      const added = await callTool("add_note", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "hello",
        author: { kind: "human" },
      });

      const ack = await callTool("set_note_status", { noteId: added.id, status: "resolved" });
      expect(ack).toEqual({
        noteId: added.id,
        status: "resolved",
        updatedAt: expect.any(String),
      });
    });
  });

  describe("save_session_notes path scoping", () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), "mdreadr-save-notes-test-"));
      sessionStore.setDocument({ path: join(dir, "doc.md") }, "# doc");
    });

    afterEach(async () => {
      sessionStore.clearDocument();
      await rm(dir, { recursive: true, force: true });
    });

    it("rejects a save path outside the Document's directory and home", async () => {
      const result = await callTool("save_session_notes", { path: "/etc/mdreadr-notes-test.json" });
      expect(result).toEqual({
        error: "Path not allowed: /etc/mdreadr-notes-test.json",
        code: "PathNotAllowed",
      });
    });

    it("saves inside the open Document's directory", async () => {
      const path = join(dir, "notes.json");
      const result = await callTool("save_session_notes", { path });
      expect(result).toBe("Saved successfully");
      expect(await Bun.file(path).exists()).toBe(true);
    });
  });

  describe("open_document", () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), "mdreadr-open-document-test-"));
      sessionStore.setDocument({ path: join(dir, "current.md") }, "# current");
    });

    afterEach(async () => {
      sessionStore.clearDocument();
      await rm(dir, { recursive: true, force: true });
    });

    it("opens a Markdown file, making it the current document", async () => {
      const target = join(dir, "target.md");
      await Bun.write(target, "# Target\nContent");
      const result = await callTool("open_document", { path: target });
      expect(result.path).toBe(target);
      expect(result.content).toBe("# Target\nContent");
      expect(sessionStore.snapshot().document?.path).toBe(target);
    });

    it("returns a structured error for a non-existent file", async () => {
      const target = join(dir, "missing.md");
      const result = await callTool("open_document", { path: target });
      expect(result).toEqual({
        error: `Document not found: ${target}`,
        code: "DocumentNotFound",
      });
    });

    it("rejects a path outside the workspace root", async () => {
      const result = await callTool("open_document", { path: "/etc/mdreadr-open-test.md" });
      expect(result).toEqual({
        error: "Path not allowed: /etc/mdreadr-open-test.md",
        code: "PathNotAllowed",
      });
    });

    it("rejects an unsupported file type", async () => {
      const target = join(dir, "notes.txt");
      await Bun.write(target, "plain text");
      const result = await callTool("open_document", { path: target });
      expect(result).toEqual({
        error: `Unsupported document type: ${target}`,
        code: "UnsupportedDocumentType",
      });
    });

    it("reopening an already-open path keeps it current", async () => {
      const target = join(dir, "briefing.md");
      await Bun.write(target, "# Briefing");
      await callTool("open_document", { path: target });

      sessionStore.setDocument({ path: join(dir, "current.md") }, "# current");
      const reopened = await callTool("open_document", { path: target });
      expect(reopened.path).toBe(target);
    });
  });

  describe("HITL loop improvements", () => {
    const doc = ["# Title", "", "## Code", "", "```ts", "const x = 1;", "```", ""].join("\n");

    type DocBlock = {
      kind: string;
      blockId: string;
      label: string;
      headingPath: string[];
      language?: string;
    };

    it("get_document_blocks lists anchorable blocks with ids for propose_edit", async () => {
      sessionStore.setDocument({ path: "/tmp/hitl.md" }, doc);
      const { blocks } = await callTool("get_document_blocks", {});
      expect(blocks.map((block: DocBlock) => block.kind)).toEqual(["heading", "heading", "code"]);
      const code = blocks.find((block: DocBlock) => block.kind === "code");
      expect(code.language).toBe("ts");
      expect(code.headingPath).toEqual(["Title", "Code"]);

      const suggestion = await callTool("propose_edit", {
        anchor: { kind: "code", blockId: code.blockId },
        replacementText: "const x = 2;",
      });
      expect(suggestion.status).toBe("pending");
    });

    it("get_document_blocks returns an empty list when no document is open", async () => {
      const { blocks } = await callTool("get_document_blocks", {});
      expect(blocks).toEqual([]);
    });

    it("get_suggestions / get_suggestion expose status for the accept/reject round-trip", async () => {
      sessionStore.setDocument({ path: "/tmp/hitl.md" }, doc);
      const { blocks } = await callTool("get_document_blocks", {});
      const code = blocks.find((block: DocBlock) => block.kind === "code");
      const created = await callTool("propose_edit", {
        anchor: { kind: "code", blockId: code.blockId },
        replacementText: "const x = 2;",
      });

      const { suggestions } = await callTool("get_suggestions", {});
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].status).toBe("pending");
      expect(suggestions[0].replacementText).toBeUndefined();

      const [pending] = sessionStore.getSuggestions();
      if (!pending) throw new Error("expected a pending suggestion");
      sessionStore.setSuggestions([{ ...pending, status: "accepted" }]);

      const one = await callTool("get_suggestion", { suggestionId: created.id });
      expect(one.status).toBe("accepted");
      expect(one.replacementText).toBe("const x = 2;");

      const verbose = await callTool("get_suggestions", { verbose: true });
      expect(verbose.suggestions[0].replacementText).toBe("const x = 2;");
    });

    it("get_suggestion throws for an unknown id", async () => {
      const result = await callTool("get_suggestion", { suggestionId: "nope" });
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("Suggestion not found: nope");
    });

    it("events carry an entity summary and responses include latestSeq", async () => {
      sessionStore.setDocument({ path: "/tmp/hitl.md" }, doc);
      const before = await callTool("get_events", { sinceSeq: 0 });
      const sinceSeq = before.latestSeq;

      const added = await callTool("add_note", {
        anchor: { kind: "heading", blockId: "heading-code", label: "Code" },
        body: "look here",
        author: { kind: "human" },
        kind: "request",
      });

      const { events, latestSeq } = await callTool("get_events", { sinceSeq });
      expect(events).toHaveLength(1);
      expect(events[0].entityId).toBe(added.id);
      expect(latestSeq).toBeGreaterThan(sinceSeq);
      expect(events[0].summary).toMatchObject({
        entity: "note",
        kind: "request",
        status: "open",
        blockId: "heading-code",
        label: "Code",
        replies: 1,
        lastAuthor: "human",
      });
    });

    it("get_current_document reports latestSeq so a watcher can seed from now", async () => {
      sessionStore.setDocument({ path: "/tmp/hitl.md" }, doc);
      const current = await callTool("get_current_document", {});
      expect(current.latestSeq).toBe(sessionStore.latestSeq());
    });
  });

  describe("Code Mode MCP", () => {
    it("executes script using mdreadr helper to query document and notes", async () => {
      sessionStore.setDocument({ path: "/tmp/codemode.md" }, "# Code Mode Test\n\nSome paragraph");
      await callTool("add_note", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "Test note for code mode",
        author: { kind: "human" },
      });

      const code = `
        const doc = mdreadr.getDocument();
        const notes = mdreadr.getNotes();
        const blocks = mdreadr.getBlocks();
        return { path: doc.path, noteCount: notes.length, blockCount: blocks.length };
      `;

      const res = await callTool("run_script", { code });
      expect(res.success).toBe(true);
      expect(res.result.path).toBe("/tmp/codemode.md");
      expect(res.result.noteCount).toBe(1);
      expect(res.result.blockCount).toBe(2);
    });

    it("executes multi-step atomic operations in a single script turn", async () => {
      sessionStore.setDocument(
        { path: "/tmp/codemode-atomic.md" },
        "# Atomic Test\n\n```js\nconsole.log(1);\n```",
      );
      const code = `
        const blocks = mdreadr.getBlocks();
        const codeBlock = blocks.find(b => b.kind === 'code');
        const note = mdreadr.addNote({
          anchor: { kind: 'code', blockId: codeBlock.blockId },
          body: 'Automated code check',
          author: { kind: 'agent' },
          kind: 'request'
        });
        const suggestion = mdreadr.proposeEdit({
          anchor: { kind: 'code', blockId: codeBlock.blockId },
          replacementText: 'console.log(2);',
          noteId: note.id
        });
        mdreadr.setNoteStatus(note.id, 'resolved');
        return { noteId: note.id, suggestionId: suggestion.id };
      `;

      const res = await callTool("run_script", { code });
      expect(res.success).toBe(true);
      expect(res.result.noteId).toBeTruthy();
      expect(res.result.suggestionId).toBeTruthy();
      expect(sessionStore.getNotes()[0]?.status).toBe("resolved");
      expect(sessionStore.getSuggestions()).toHaveLength(1);
    });
  });
});
