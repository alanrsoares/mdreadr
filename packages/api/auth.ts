export type SessionTokens = {
  agentToken: string;
  webviewToken: string;
};

/**
 * Per-process, per-launch guard-rail tokens (mirrors the discovery-file
 * token pattern used by `~/.claude/skills/impeccable`'s `live` command).
 * `agentToken` is written to `~/.config/mdreadr/mcp.json` for MCP clients;
 * `webviewToken` is never written to disk, only injected into the webview
 * at launch. Both live for the process lifetime — no rotation.
 */
export const sessionTokens: SessionTokens = {
  agentToken: crypto.randomUUID(),
  webviewToken: crypto.randomUUID(),
};

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export function isAgentAuthorized(request: Request): boolean {
  return bearerToken(request) === sessionTokens.agentToken;
}

export function isWebviewAuthorized(request: Request): boolean {
  return bearerToken(request) === sessionTokens.webviewToken;
}
