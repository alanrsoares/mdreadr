import { StatusDot } from "@astryxdesign/core/StatusDot";
import { useMcpClients } from "../session/useMcpClients.ts";

/**
 * Live dot next to the MCP settings button: pulses green while one or more MCP
 * clients hold a session, neutral when none are connected.
 */
export function McpClientsIndicator() {
  const clients = useMcpClients();
  const count = clients.data?.count ?? 0;
  const isConnected = count > 0;

  const label = isConnected
    ? `${count} MCP client${count === 1 ? "" : "s"} connected`
    : "No MCP clients connected";

  return (
    <StatusDot
      variant={isConnected ? "success" : "neutral"}
      label={label}
      tooltip={label}
      isPulsing={isConnected}
    />
  );
}
