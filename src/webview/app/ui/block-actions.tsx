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

type BlockActionsProps = {
  anchor: BlockAnchor;
  onPin?: (anchor: BlockAnchor) => void;
  onEdit?: (anchor: BlockAnchor) => void;
};

export function BlockActions({ anchor, onPin, onEdit }: BlockActionsProps) {
  if (!onPin && !onEdit) return null;

  return (
    <div className="reader-block-actions" role="toolbar" aria-label="Block actions">
      {onEdit ? <EditBlockButton anchor={anchor} onEdit={onEdit} /> : null}
      {onPin ? <PinButton anchor={anchor} onPin={onPin} /> : null}
    </div>
  );
}
