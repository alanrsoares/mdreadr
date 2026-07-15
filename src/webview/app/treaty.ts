import { treaty } from "@elysiajs/eden";
import type { App } from "../../../packages/api/index.ts";

export function getApiBase(): string {
  const injected = (window as Window & { __MDREADR_API__?: string }).__MDREADR_API__;
  if (injected) return injected;
  const fromQuery = new URLSearchParams(window.location.search).get("api");
  return fromQuery ? fromQuery : "http://127.0.0.1:3000";
}

export const api = treaty<App>(getApiBase());

export type ApiClient = typeof api;
