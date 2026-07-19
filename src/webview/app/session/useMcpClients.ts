import { useQuery } from "@tanstack/react-query";
import { api } from "../treaty.ts";
import { unwrap } from "./reader-api.ts";

export type McpClient = {
  id: string;
  name: string | null;
  version: string | null;
  connectedAt: string;
};

export type McpClientsResult = { clients: McpClient[]; count: number };

/**
 * Live count of connected MCP client sessions. The backend has no event stream
 * for connections, so this polls on an interval to keep the status indicator fresh.
 */
export function useMcpClients() {
  return useQuery<McpClientsResult>({
    queryKey: ["mcp-clients"],
    queryFn: async () => unwrap(await api.mcp.clients.get()) as McpClientsResult,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });
}
