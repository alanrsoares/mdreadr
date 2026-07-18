import { treaty } from "@elysiajs/eden";
import type { App } from "../../../packages/api/index.ts";

export function getApiBase(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:3000";
  const injected = (window as Window & { __MDREADR_API__?: string }).__MDREADR_API__;
  if (injected) return injected;
  const fromQuery = new URLSearchParams(window.location.search).get("api");
  return fromQuery ? fromQuery : "http://127.0.0.1:3000";
}

/**
 * Per-launch token required by /documents/save, /notes/load, and /suggestions*
 * (packages/api/auth.ts). Injected via Electrobun preload, same seam as
 * `__MDREADR_API__` — never written to disk, unlike the MCP agent token.
 */
export function getWebviewToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { __MDREADR_WEBVIEW_TOKEN__?: string }).__MDREADR_WEBVIEW_TOKEN__;
}

const webviewToken = getWebviewToken();

export const api = treaty<App>(getApiBase(), {
  headers: webviewToken ? { Authorization: `Bearer ${webviewToken}` } : undefined,
});

export type ApiClient = typeof api;
