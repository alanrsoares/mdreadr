import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { nowIso } from "../../domain/index.ts";
import { activityToolHandlers, activityTools } from "./activity-tools.ts";
import { documentToolHandlers, documentTools } from "./document-tools.ts";
import { noteToolHandlers, noteTools } from "./note-tools.ts";
import { suggestionToolHandlers, suggestionTools } from "./suggestion-tools.ts";

const tools = [...documentTools, ...noteTools, ...suggestionTools, ...activityTools];
const toolHandlers = {
  ...documentToolHandlers,
  ...noteToolHandlers,
  ...suggestionToolHandlers,
  ...activityToolHandlers,
};

function createMcpServer(): Server {
  const server = new Server(
    {
      name: "mdreadr",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );
  registerHandlers(server);
  return server;
}

function registerHandlers(mcpServer: Server) {
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler = toolHandlers[request.params.name];
    if (!handler) {
      throw new Error(`Tool not found: ${request.params.name}`);
    }
    return handler(request.params.arguments ?? {});
  });
}

/** Test-only entry point: handlers registered but never connected to a transport. */
export const mcpServer = createMcpServer();

type McpSession = {
  server: Server;
  transport: WebStandardStreamableHTTPServerTransport;
  connectedAt: string;
  lastSeenAt: number;
};

/**
 * How long a session may go without a routed request before it is treated as
 * gone. Streamable-HTTP clients rarely send an explicit DELETE on disconnect
 * (the SDK only does so via `terminateSession()`), and the transport gives no
 * disconnect callback — so "connected" means "made a request within this
 * window". mdreadr agents long-poll `wait_for_activity` at <=25s, staying live.
 */
const CLIENT_STALE_MS = 60_000;

/** A live MCP client session, as surfaced to the webview status indicator. */
export type ConnectedClient = {
  id: string;
  name: string | null;
  version: string | null;
  connectedAt: string;
};

/**
 * Active MCP client sessions, newest first. Prunes sessions idle longer than
 * `CLIENT_STALE_MS` as a side effect, then reads clientInfo captured at `initialize`.
 */
export function getConnectedClients(): ConnectedClient[] {
  const cutoff = Date.now() - CLIENT_STALE_MS;
  for (const [id, session] of sessions) {
    if (session.lastSeenAt < cutoff) {
      sessions.delete(id);
    }
  }
  return [...sessions.entries()]
    .map(([id, session]) => {
      const info = session.server.getClientVersion();
      return {
        id,
        name: info?.name ?? null,
        version: info?.version ?? null,
        connectedAt: session.connectedAt,
      };
    })
    .sort((a, b) => b.connectedAt.localeCompare(a.connectedAt));
}

/**
 * The SDK's Server/transport pair is single-session (Server.connect() throws if
 * called twice). Each real client session gets its own Server+transport instance,
 * keyed by the SDK-generated session id, instead of one global transport reset
 * between requests (which clobbered concurrent clients' state).
 */
const sessions = new Map<string, McpSession>();

function createSession(): McpSession {
  const server = createMcpServer();
  let session: McpSession;
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { ...session, connectedAt: nowIso(), lastSeenAt: Date.now() });
    },
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
    },
  });
  session = { server, transport, connectedAt: nowIso(), lastSeenAt: Date.now() };
  server.connect(transport).catch(console.error);
  return session;
}

function normalizeMcpRequest(request: Request): Request {
  const accept = request.headers.get("accept");
  if (!accept?.includes("text/event-stream") || !accept?.includes("application/json")) {
    const newHeaders = new Headers(request.headers);
    newHeaders.set("accept", "application/json, text/event-stream");
    return new Request(request, { headers: newHeaders });
  }
  return request;
}

/** Routes a request to its session's transport by `mcp-session-id`, creating a fresh session for header-less (i.e. initialize) requests. */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const req = normalizeMcpRequest(request);
  const sessionId = req.headers.get("mcp-session-id");
  if (sessionId) {
    const existing = sessions.get(sessionId);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    existing.lastSeenAt = Date.now();
    return existing.transport.handleRequest(req);
  }
  const { transport } = createSession();
  return transport.handleRequest(req);
}
