import { Icon } from "@astryxdesign/core/Icon";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import type { BlockAnchor } from "@mdreadr/domain";
import { MapPinIcon, PencilSquareIcon } from "../icons.ts";
import { anchorDisplayLabel } from "../markdown/anchors.ts";

type EditBlockButtonProps = {
  onEdit: (anchor: BlockAnchor) => void;
  anchor: BlockAnchor;
};

export function EditBlockButton({ onEdit, anchor }: EditBlockButtonProps) {
  const targetLabel = anchorDisplayLabel(anchor);
  const accessibleLabel = `Edit ${targetLabel} inline`;

  return (
    <Tooltip content="Edit block" placement="end">
      <button
        type="button"
        className="reader-edit-button"
        aria-label={accessibleLabel}
        onClick={(event) => {
          event.stopPropagation();
          onEdit(anchor);
        }}
      >
        <Icon icon={PencilSquareIcon} size="sm" />
      </button>
    </Tooltip>
  );
}

type PinButtonProps = {
  onPin: (anchor: BlockAnchor) => void;
  anchor: BlockAnchor;
};

export function PinButton({ onPin, anchor }: PinButtonProps) {
  const targetLabel = anchorDisplayLabel(anchor);
  const accessibleLabel = `Anchor a note to ${targetLabel}`;

  return (
    <Tooltip content="Anchor a note" placement="end">
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
