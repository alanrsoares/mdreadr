import { sessionStore } from "../session.ts";
import {
  DEFAULT_WAIT_TIMEOUT_MS,
  MAX_WAIT_TIMEOUT_MS,
  type ToolDefinition,
  type ToolHandler,
  toolJson,
} from "./shared.ts";

export const activityTools: ToolDefinition[] = [
  {
    name: "wait_for_activity",
    description:
      "Long-poll for session activity (notes, replies, status changes, suggestions) newer than sinceSeq. Resolves immediately if activity already happened, otherwise waits up to timeoutMs (default 25000, capped at 600000) before resolving with an empty events list. Call again with the highest seq seen to keep watching. For watching without holding an MCP call open, prefer the HTTP endpoint GET /events/wait?sinceSeq=N&timeoutMs=M on the same server (e.g. from a background curl): it blocks the same way and exits when activity lands.",
    inputSchema: {
      type: "object",
      properties: {
        sinceSeq: {
          type: "number",
          description: "The highest journal seq already seen. Use 0 to catch everything.",
        },
        timeoutMs: {
          type: "number",
          description: "Max time to wait before resolving with no events. Defaults to 25000.",
        },
      },
      required: ["sinceSeq"],
    },
  },
  {
    name: "get_events",
    description:
      "Non-blocking catch-up read of journal entries newer than sinceSeq. Each event carries a `summary` of the entity it touched (note kind/status/last-author, or suggestion status), so you can act without a follow-up read. Response also includes `latestSeq`. Use this to resume after a reconnect instead of waiting.",
    inputSchema: {
      type: "object",
      properties: {
        sinceSeq: {
          type: "number",
          description: "The highest journal seq already seen. Use 0 to catch everything.",
        },
      },
      required: ["sinceSeq"],
    },
  },
];

export const activityToolHandlers: Record<string, ToolHandler> = {
  wait_for_activity: async (args) => {
    const params = args as { sinceSeq: number; timeoutMs?: number };
    const timeoutMs = Math.min(params.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS, MAX_WAIT_TIMEOUT_MS);
    const events = await sessionStore.waitForActivity(params.sinceSeq, timeoutMs);
    return toolJson({
      events: sessionStore.enrichEvents(events),
      latestSeq: sessionStore.latestSeq(),
    });
  },
  get_events: (args) => {
    const params = args as { sinceSeq: number };
    return toolJson({
      events: sessionStore.getEnrichedEvents(params.sinceSeq),
      latestSeq: sessionStore.latestSeq(),
    });
  },
};
