import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type SessionTokens = {
  agentToken: string;
  webviewToken: string;
};

const configDir = join(homedir(), ".config", "mdreadr");
const agentTokenPath = join(configDir, "agent-token.json");

async function persistNewAgentToken(): Promise<string> {
  const token = crypto.randomUUID();
  await mkdir(configDir, { recursive: true });
  await writeFile(agentTokenPath, JSON.stringify({ token }, null, 2));
  return token;
}

async function loadOrCreateAgentToken(): Promise<string> {
  try {
    const raw = await readFile(agentTokenPath, "utf8");
    const token = (JSON.parse(raw) as { token?: string }).token;
    if (token) return token;
  } catch {}
  return persistNewAgentToken();
}

/**
 * `agentToken` is a long-lived secret persisted to `~/.config/mdreadr/agent-token.json`
 * so MCP client configs (URL + token) stay valid across app restarts — see
 * `revokeAgentToken` to rotate it. `webviewToken` is still per-process and
 * never written to disk, only injected into the webview at launch.
 */
export const sessionTokens: SessionTokens = {
  agentToken: await loadOrCreateAgentToken(),
  webviewToken: crypto.randomUUID(),
};

/** Rotates the persisted agent token, invalidating every existing MCP client config. */
export async function revokeAgentToken(): Promise<string> {
  const token = await persistNewAgentToken();
  sessionTokens.agentToken = token;
  return token;
}

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
