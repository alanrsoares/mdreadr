import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import type { DocumentKind } from "@mdreadr/domain";
import { EyeIcon, PencilSquareIcon } from "../icons.ts";

export type DocumentViewMode = "preview" | "edit";

type DocumentViewModeSwitchProps = {
  value: DocumentViewMode;
  onChange: (mode: DocumentViewMode) => void;
  /**
   * Only markdown has both modes. The switch still renders for the others —
   * with the mode they cannot reach disabled — so the chrome does not move
   * when a Tab opens a file of a different kind.
   */
  kind?: DocumentKind;
};

export function DocumentViewModeSwitch({
  value,
  onChange,
  kind = "markdown",
}: DocumentViewModeSwitchProps) {
  const canPreview = kind !== "source";
  const canEdit = kind !== "image";

  const selectMode = (next: string) => {
    if (next === "preview" || next === "edit") {
      onChange(next);
    }
  };

  return (
    <SegmentedControl
      label="Document view mode"
      size="sm"
      layout="hug"
      value={value}
      onChange={selectMode}
    >
      <Tooltip content={canPreview ? "Preview" : "No preview: this file is not markdown"}>
        <SegmentedControlItem
          value="preview"
          label="Preview"
          isLabelHidden
          isDisabled={!canPreview}
          icon={<Icon icon={EyeIcon} size="sm" />}
        />
      </Tooltip>
      <Tooltip content={canEdit ? "Edit source" : "No source to edit: this file is an image"}>
        <SegmentedControlItem
          value="edit"
          label="Edit"
          isLabelHidden
          isDisabled={!canEdit}
          icon={<Icon icon={PencilSquareIcon} size="sm" />}
        />
      </Tooltip>
    </SegmentedControl>
  );
}
