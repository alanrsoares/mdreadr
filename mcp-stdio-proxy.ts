import { watch } from "node:fs";
import fs from "node:fs/promises";
import { homedir } from "node:os";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export type McpConfig = { url: string; token?: string };
export type JournalEntry = { seq: number; ts: string; type: string; entityId: string };

const DEFAULT_URL = "http://127.0.0.1:50932/mcp";

export async function readConfig(configPath: string): Promise<McpConfig> {
  try {
    const configData = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configData);
    return {
      url: config?.mcpServers?.mdreadr?.url ?? DEFAULT_URL,
      token: config?.mcpServers?.mdreadr?.token,
    };
  } catch {
    return { url: DEFAULT_URL };
  }
}

/** Entries with `seq > knownMaxSeq`, oldest first — what's actually new to persist. */
export function mergeNewJournalEntries(
  knownMaxSeq: number,
  entries: JournalEntry[],
): JournalEntry[] {
  return entries.filter((entry) => entry.seq > knownMaxSeq).sort((a, b) => a.seq - b.seq);
}

export async function loadPersistedMaxSeq(journalPath: string): Promise<number> {
  try {
    const raw = await fs.readFile(journalPath, "utf-8");
    let max = 0;
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as JournalEntry;
      if (entry.seq > max) max = entry.seq;
    }
    return max;
  } catch {
    return 0;
  }
}

export async function appendJournalEntries(
  journalPath: string,
  entries: JournalEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const lines = `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
  await fs.appendFile(journalPath, lines, "utf-8");
}

async function main() {
  const configDir = `${homedir()}/.config/mdreadr`;
  const configPath = `${configDir}/mcp.json`;
  const journalPath = `${configDir}/session.jsonl`;

  let config = await readConfig(configPath);
  let lastSeq = await loadPersistedMaxSeq(journalPath);
  let httpStartPromise: Promise<void> | null = null;
  let processQueue: Promise<void> = Promise.resolve();
  // Downstream-issued wait_for_activity/get_events calls: snoop the response for
  // journal entries to persist, then forward it on like any other response.
  const journalSnoopIds = new Set<string | number>();
  // Calls the proxy itself issues against the new transport on reconnect (replayed
  // initialize, resume get_events): persist-only, never forwarded to stdio — the
  // downstream client never asked for these and has no id to match them against.
  const internalOnlyIds = new Set<string | number>();
  let lastInitializeMessage: Record<string, unknown> | null = null;
  let sawInitializedNotification = false;

  const stdioTransport = new StdioServerTransport();
  await stdioTransport.start();

  async function persistIfJournalShaped(message: unknown) {
    const response = message as { result?: { content?: Array<{ type: string; text: string }> } };
    const text = response.result?.content?.[0]?.text;
    if (!text) return;
    try {
      const parsed = JSON.parse(text) as { events?: JournalEntry[] };
      const fresh = mergeNewJournalEntries(lastSeq, parsed.events ?? []);
      if (fresh.length > 0) {
        await appendJournalEntries(journalPath, fresh);
        lastSeq = fresh[fresh.length - 1]?.seq ?? lastSeq;
      }
    } catch {
      // response wasn't journal-shaped (e.g. a different tool call); ignore
    }
  }

  async function handleHttpMessage(message: unknown) {
    const response = message as { id?: string | number };
    const id = response.id;
    const wasInternal = id !== undefined && internalOnlyIds.delete(id);
    const wasJournalSnoop = id !== undefined && journalSnoopIds.delete(id);
    if (wasInternal || wasJournalSnoop) {
      await persistIfJournalShaped(message);
    }
    if (wasInternal) return;
    try {
      await stdioTransport.send(message as Parameters<typeof stdioTransport.send>[0]);
    } catch (e) {
      console.error(e);
    }
  }

  function createHttpTransport(cfg: McpConfig) {
    const transport = new StreamableHTTPClientTransport(cfg.url as unknown as URL, {
      requestInit: cfg.token ? { headers: { Authorization: `Bearer ${cfg.token}` } } : undefined,
    });
    transport.onmessage = handleHttpMessage;
    transport.onclose = () => {
      // Reconnect is watcher/send-failure-driven below, not close-driven.
    };
    return transport;
  }

  let httpTransport = createHttpTransport(config);

  /**
   * Swap to a freshly-pointed transport. A new server means a new MCP session, so
   * replay the handshake the downstream client already completed once (it's not
   * expecting a second response, hence internalOnlyIds) before pulling anything
   * the new server already knows about since our last-seen seq — so a Note added
   * during the app's restart window isn't silently dropped once the agent resumes
   * its own wait_for_activity loop.
   */
  async function reconnect(newConfig: McpConfig) {
    const oldTransport = httpTransport;
    config = newConfig;
    httpTransport = createHttpTransport(newConfig);
    httpStartPromise = httpTransport.start();
    await httpStartPromise;
    try {
      await oldTransport.close();
    } catch {
      // already dead; ignore
    }

    if (lastInitializeMessage) {
      const replayId = crypto.randomUUID();
      internalOnlyIds.add(replayId);
      try {
        await httpTransport.send({
          ...lastInitializeMessage,
          id: replayId,
        } as unknown as Parameters<typeof httpTransport.send>[0]);
      } catch (e) {
        console.error("Re-initialize after reconnect failed:", e);
      }
      if (sawInitializedNotification) {
        try {
          await httpTransport.send({
            jsonrpc: "2.0",
            method: "notifications/initialized",
          } as unknown as Parameters<typeof httpTransport.send>[0]);
        } catch (e) {
          console.error("Re-sending initialized notification failed:", e);
        }
      }
    }

    const id = crypto.randomUUID();
    internalOnlyIds.add(id);
    try {
      await httpTransport.send({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: "get_events", arguments: { sinceSeq: lastSeq } },
      } as unknown as Parameters<typeof httpTransport.send>[0]);
    } catch (e) {
      console.error("Resume get_events failed:", e);
    }
  }

  try {
    watch(configDir, { persistent: false }, (_event, filename) => {
      if (filename !== "mcp.json") return;
      readConfig(configPath).then((newConfig) => {
        if (newConfig.url !== config.url || newConfig.token !== config.token) {
          reconnect(newConfig).catch((e) => console.error("Reconnect failed:", e));
        }
      });
    });
  } catch (e) {
    console.error("Could not watch mcp.json for changes:", e);
  }

  // Forward messages from Stdio to HTTP sequentially
  stdioTransport.onmessage = (message) => {
    processQueue = processQueue.then(async () => {
      const msg = message as {
        id?: string | number;
        method?: string;
        params?: { name?: string };
      };
      if (msg.method === "initialize") {
        lastInitializeMessage = message as Record<string, unknown>;
        sawInitializedNotification = false;
      }
      if (msg.method === "notifications/initialized") {
        sawInitializedNotification = true;
      }
      if (
        msg.id !== undefined &&
        msg.method === "tools/call" &&
        (msg.params?.name === "wait_for_activity" || msg.params?.name === "get_events")
      ) {
        journalSnoopIds.add(msg.id);
      }
      try {
        if (!httpStartPromise) {
          httpStartPromise = httpTransport.start();
        }
        await httpStartPromise;
        await httpTransport.send(message);
      } catch (e) {
        console.error("Failed to forward to HTTP:", e);
        // The watcher may have raced the actual file write — re-read once before giving up.
        const refreshed = await readConfig(configPath);
        if (refreshed.url !== config.url || refreshed.token !== config.token) {
          try {
            await reconnect(refreshed);
            await httpTransport.send(message);
            return;
          } catch (retryErr) {
            console.error("Retry after config refresh failed:", retryErr);
          }
        }
        // Return a JSON-RPC error back to stdio so the client doesn't hang forever
        if (msg.id !== undefined) {
          await stdioTransport.send({
            jsonrpc: "2.0",
            id: msg.id,
            error: {
              code: -32603,
              message: "mdreadr server is not running. Please start mdreadr and try again.",
            },
          } as unknown as Parameters<typeof stdioTransport.send>[0]);
        }
      }
    });
  };

  // Handle closes without exiting immediately
  stdioTransport.onclose = () => {
    process.exit(0);
  };
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
