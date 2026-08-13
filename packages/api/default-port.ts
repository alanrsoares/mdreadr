/**
 * Shared so the webview's API-base fallback and the server's listen port can't
 * drift apart. Value is stable on purpose: MCP client configs (URL + persisted
 * agent token, see auth.ts) keep working across restarts.
 *
 * Kept in its own module because the webview imports it — pulling
 * `packages/api/index.ts` in for a value would bundle the whole server.
 */
export const DEFAULT_API_PORT = 47813;
