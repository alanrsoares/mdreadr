import { treaty } from "@elysiajs/eden";
import { DEFAULT_API_PORT } from "../../../packages/api/default-port.ts";
import type { App } from "../../../packages/api/index.ts";

/** Only reached when the Electrobun preload injection and `?api=` both fail. */
const FALLBACK_API_BASE = `http://127.0.0.1:${DEFAULT_API_PORT}`;

export function getApiBase(): string {
  if (typeof window === "undefined") return FALLBACK_API_BASE;
  const injected = (window as Window & { __MDREADR_API__?: string }).__MDREADR_API__;
  if (injected) return injected;
  const fromQuery = new URLSearchParams(window.location.search).get("api");
  return fromQuery ? fromQuery : FALLBACK_API_BASE;
}

/**
 * Per-launch token required by /documents/save, /notes/load, and /suggestions*
 * (packages/api/auth.ts). Injected via Electrobun preload, same seam as
 * `__MDREADR_API__` — never written to disk, unlike the MCP agent token.
 */
export const getWebviewToken = (): string | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as Window & { __MDREADR_WEBVIEW_TOKEN__?: string }).__MDREADR_WEBVIEW_TOKEN__;

const webviewToken = getWebviewToken();

export const api = treaty<App>(getApiBase(), {
  headers: webviewToken ? { Authorization: `Bearer ${webviewToken}` } : undefined,
});

export type ApiClient = typeof api;
