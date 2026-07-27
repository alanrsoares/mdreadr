import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sessionStore } from "../session.ts";
import {
  DEFAULT_WAIT_TIMEOUT_MS,
  MAX_WAIT_TIMEOUT_MS,
  sinceSeqSchema,
  toolJson,
} from "./shared.ts";

export function registerActivityTools(server: McpServer): void {
  server.registerTool(
    "wait_for_activity",
    {
      description:
        "Long-poll for session activity (notes, replies, status changes, suggestions) newer than sinceSeq. Resolves immediately if activity already happened, otherwise waits up to timeoutMs (default 25000, capped at 600000) before resolving with an empty events list. Call again with the highest seq seen to keep watching. For watching without holding an MCP call open, prefer the HTTP endpoint GET /events/wait?sinceSeq=N&timeoutMs=M on the same server (e.g. from a background curl): it blocks the same way and exits when activity lands.",
      inputSchema: {
        sinceSeq: sinceSeqSchema,
        timeoutMs: z
          .number()
          .optional()
          .describe("Max time to wait before resolving with no events. Defaults to 25000."),
      },
    },
    async ({ sinceSeq, timeoutMs }) => {
      const effectiveTimeoutMs = Math.min(
        timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
        MAX_WAIT_TIMEOUT_MS,
      );
      const events = await sessionStore.waitForActivity(sinceSeq, effectiveTimeoutMs);
      return toolJson({
        events: sessionStore.enrichEvents(events),
        latestSeq: sessionStore.latestSeq(),
      });
    },
  );

  server.registerTool(
    "get_events",
    {
      description:
        "Non-blocking catch-up read of journal entries newer than sinceSeq. Each event carries a `summary` of the entity it touched (note kind/status/last-author, or suggestion status), so you can act without a follow-up read. Response also includes `latestSeq`. Use this to resume after a reconnect instead of waiting.",
      inputSchema: { sinceSeq: sinceSeqSchema },
    },
    ({ sinceSeq }) => {
      return toolJson({
        events: sessionStore.getEnrichedEvents(sinceSeq),
        latestSeq: sessionStore.latestSeq(),
      });
    },
  );
}
