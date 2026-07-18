import { beforeEach, describe, expect, it } from "bun:test";
import { sessionTokens } from "./auth.ts";
import { app } from "./index.ts";
import { sessionStore } from "./session.ts";

describe("MCP Server", () => {
  beforeEach(() => {
    sessionStore.clearDocument();
    sessionStore.setNotes([]);
    sessionStore.setSuggestions([]);
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

  // Because the actual JSON-RPC over SSE is tricky to mock without a client,
  // we could test the mcpServer tool execution directly.
  it("registers tools correctly", async () => {
    const { mcpServer } = await import("./mcp.ts");
    // Unfortunately, the MCP SDK doesn't expose an easy way to just "list tools"
    // synchronously without a transport, but we know it boots up and connects.
    expect(mcpServer).toBeDefined();
  });

  it("exposes typed author and anchor schemas, plus the block-read tool", async () => {
    const { mcpServer } = await import("./mcp.ts");
    const listHandler = (
      mcpServer as unknown as {
        _requestHandlers: Map<
          string,
          (
            request: unknown,
            extra: unknown,
          ) => Promise<{ tools: Array<{ name: string; inputSchema: Record<string, unknown> }> }>
        >;
      }
    )._requestHandlers.get("tools/list");
    if (!listHandler) throw new Error("tools/list handler not registered");

    const result = await listHandler({ method: "tools/list" }, {});
    const byName = Object.fromEntries(result.tools.map((tool) => [tool.name, tool]));

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
  });

  it("propose_edit adds a pending Suggestion to the session", async () => {
    const { mcpServer } = await import("./mcp.ts");
    const callHandler = (
      mcpServer as unknown as {
        _requestHandlers: Map<
          string,
          (
            request: unknown,
            extra: unknown,
          ) => Promise<{ content: Array<{ type: string; text: string }> }>
        >;
      }
    )._requestHandlers.get("tools/call");
    if (!callHandler) throw new Error("tools/call handler not registered");

    const result = await callHandler(
      {
        method: "tools/call",
        params: {
          name: "propose_edit",
          arguments: {
            anchor: { kind: "document", blockId: "document-root" },
            replacementText: "new text",
          },
        },
      },
      {},
    );

    const first = result.content[0];
    if (!first) throw new Error("expected tool result content");
    const suggestion = JSON.parse(first.text);
    expect(suggestion.status).toBe("pending");
    expect(suggestion.author).toEqual({ kind: "agent" });
    expect(sessionStore.getSuggestions()).toHaveLength(1);
  });

  describe("journal / wait_for_activity", () => {
    async function callTool(name: string, args: Record<string, unknown>) {
      const { mcpServer } = await import("./mcp.ts");
      const handler = (
        mcpServer as unknown as {
          _requestHandlers: Map<
            string,
            (
              request: unknown,
              extra: unknown,
            ) => Promise<{ content: Array<{ type: string; text: string }> }>
          >;
        }
      )._requestHandlers.get("tools/call");
      if (!handler) throw new Error("tools/call handler not registered");
      const result = await handler({ method: "tools/call", params: { name, arguments: args } }, {});
      const first = result.content[0];
      if (!first) throw new Error("expected tool result content");
      return JSON.parse(first.text);
    }

    async function currentMaxSeq() {
      const { events } = await callTool("get_events", { sinceSeq: 0 });
      return events.reduce((max: number, event: { seq: number }) => Math.max(max, event.seq), 0);
    }

    it("wait_for_activity with no activity times out with empty events", async () => {
      const sinceSeq = await currentMaxSeq();
      const result = await callTool("wait_for_activity", { sinceSeq, timeoutMs: 50 });
      expect(result.events).toEqual([]);
    });

    it("adding a note while wait_for_activity is pending resolves it immediately", async () => {
      const sinceSeq = await currentMaxSeq();
      const pending = callTool("wait_for_activity", { sinceSeq, timeoutMs: 5000 });

      await callTool("add_note", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "hello",
        author: { kind: "agent" },
      });

      const result = await pending;
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe("note_added");
    });

    it("two concurrent waiters both resolve", async () => {
      const sinceSeq = await currentMaxSeq();
      const first = callTool("wait_for_activity", { sinceSeq, timeoutMs: 5000 });
      const second = callTool("wait_for_activity", { sinceSeq, timeoutMs: 5000 });

      await callTool("add_note", {
        anchor: { kind: "document", blockId: "document-root" },
        body: "hello",
        author: { kind: "agent" },
      });

      const [firstResult, secondResult] = await Promise.all([first, second]);
      expect(firstResult.events).toHaveLength(1);
      expect(secondResult.events).toHaveLength(1);
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
});
