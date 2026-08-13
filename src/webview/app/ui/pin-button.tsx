import { Icon } from "@astryxdesign/core/Icon";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import type { BlockAnchor } from "@mdreadr/domain";
import { MapPinIcon } from "../icons.ts";
import { anchorDisplayLabel } from "../markdown/anchors.ts";

type PinButtonProps = {
  onPin: (anchor: BlockAnchor) => void;
  anchor: BlockAnchor;
};

export function PinButton({ onPin, anchor }: PinButtonProps) {
  const targetLabel = anchorDisplayLabel(anchor);
  // The visible tooltip stays short so it can't cover the block being pinned;
  // the specific target lives in aria-label, where length is useful.
  const accessibleLabel = `Pin note to ${targetLabel}`;

  return (
    <Tooltip content="Pin note" placement="start">
      <button
        type="button"
        className="reader-pin-button"
        aria-label={accessibleLabel}
        onClick={(event) => {
          event.stopPropagation();
          onPin(anchor);
        }}
      >
        <Icon icon={MapPinIcon} size="sm" />
      </button>
    </Tooltip>
  );
}
