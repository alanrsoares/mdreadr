import { beforeEach, describe, expect, it } from "bun:test";
import { app } from "./index.ts";
import { sessionStore } from "./session.ts";

describe("MCP Server", () => {
  beforeEach(() => {
    sessionStore.clearDocument();
    sessionStore.setNotes([]);
  });

  it("exposes /mcp POST endpoint for initialization", async () => {
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
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
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
  });
});
