import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { nowIso } from "../../domain/index.ts";
import { registerActivityTools } from "./activity-tools.ts";
import { registerCodeModeTools } from "./code-mode-tools.ts";
import { registerDocumentTools } from "./document-tools.ts";
import { registerNoteTools } from "./note-tools.ts";
import { registerSuggestionTools } from "./suggestion-tools.ts";

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "mdreadr", version: "0.8.0" });
  registerDocumentTools(server);
  registerNoteTools(server);
  registerSuggestionTools(server);
  registerActivityTools(server);
  registerCodeModeTools(server);
  return server;
}

/** Test-only entry point: handlers registered but never connected to a transport. */
export const mcpServer = createMcpServer();

/** A live MCP client session, as surfaced to the webview status indicator. */
export type ConnectedClient = {
  id: string;
  name: string | null;
  version: string | null;
  connectedAt: string;
};

type TrackedSession = {
  id: string;
  name: string | null;
  version: string | null;
  connectedAt: string;
  lastSeenAt: number;
};

const CLIENT_STALE_MS = 60_000;
const trackedSessions = new Map<string, TrackedSession>();

/**
 * Active MCP client sessions, newest first. Prunes sessions idle longer than
 * `CLIENT_STALE_MS` as a side effect.
 */
export function getConnectedClients(): ConnectedClient[] {
  const cutoff = Date.now() - CLIENT_STALE_MS;
  for (const [id, session] of trackedSessions) {
    if (session.lastSeenAt < cutoff) {
      trackedSessions.delete(id);
    }
  }
  return [...trackedSessions.values()]
    .map(({ id, name, version, connectedAt }) => ({
      id,
      name,
      version,
      connectedAt,
    }))
    .sort((a, b) => b.connectedAt.localeCompare(a.connectedAt));
}

const mcpHandler = createMcpHandler(() => createMcpServer());

function normalizeMcpRequest(request: Request): Request {
  const accept = request.headers.get("accept");
  if (!accept?.includes("text/event-stream") || !accept?.includes("application/json")) {
    const newHeaders = new Headers(request.headers);
    newHeaders.set("accept", "application/json, text/event-stream");
    return new Request(request, { headers: newHeaders });
  }
  return request;
}

/** Track client session details from incoming requests. */
function trackRequestSession(request: Request, bodyText?: string): void {
  const sessionId = request.headers.get("mcp-session-id");
  const now = Date.now();

  if (sessionId) {
    const existing = trackedSessions.get(sessionId);
    if (existing) {
      existing.lastSeenAt = now;
      return;
    }
  }

  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed.method === "initialize") {
        const id = sessionId ?? crypto.randomUUID();
        const clientInfo = parsed.params?.clientInfo;
        trackedSessions.set(id, {
          id,
          name: clientInfo?.name ?? null,
          version: clientInfo?.version ?? null,
          connectedAt: nowIso(),
          lastSeenAt: now,
        });
      }
    } catch {
      // Non-JSON body
    }
  }
}

/** Routes a request through MCP SDK v2 createMcpHandler. */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const req = normalizeMcpRequest(request);

  // Clone request body to inspect initialize params without consuming stream
  let bodyText: string | undefined;
  if (req.method === "POST") {
    try {
      bodyText = await req.clone().text();
    } catch {
      // body already consumed
    }
  }

  trackRequestSession(req, bodyText);
  return mcpHandler.fetch(req);
}
