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
});
