import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { useMcpClients } from "../session/useMcpClients.ts";
import { McpIcon } from "./McpIcon.tsx";

/**
 * MCP settings, with the live client count worn as a corner dot.
 *
 * The dot used to hold its own slot in the top nav, where an 8px circle sat in
 * a row of 32px buttons and read as a stray mark rather than as the status of
 * the thing beside it. Attached to the button it belongs to, the rail keeps an
 * even rhythm and the status gains an owner.
 *
 * It also only appears while something is connected: a permanent grey dot is a
 * mark with no news in it. The dot is inert (`pointer-events-none`), so it
 * can't eat a corner of the button it sits on, and the count it used to explain
 * by tooltip is folded into the button's own tooltip instead.
 */

type McpSettingsButtonProps = {
  onClick: () => void;
};

export function McpSettingsButton({ onClick }: McpSettingsButtonProps) {
  const clients = useMcpClients();
  const count = clients.data?.count ?? 0;
  const isConnected = count > 0;

  const status = isConnected
    ? `${count} client${count === 1 ? "" : "s"} connected`
    : "no clients connected";

  return (
    <div className="relative">
      <IconButton
        label="MCP settings"
        tooltip={`MCP settings — ${status}`}
        variant="ghost"
        icon={<Icon icon={McpIcon} size="sm" />}
        onClick={onClick}
      />
      {isConnected ? (
        <span className="pointer-events-none absolute top-0 right-0">
          <StatusDot variant="success" label={`MCP: ${status}`} isPulsing />
        </span>
      ) : null}
    </div>
  );
}
