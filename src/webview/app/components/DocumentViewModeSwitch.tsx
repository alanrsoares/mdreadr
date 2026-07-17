import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { EyeIcon, PencilSquareIcon } from "../icons.ts";

export type DocumentViewMode = "preview" | "edit";

type DocumentViewModeSwitchProps = {
  value: DocumentViewMode;
  onChange: (mode: DocumentViewMode) => void;
};

export function DocumentViewModeSwitch({ value, onChange }: DocumentViewModeSwitchProps) {
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
      <Tooltip content="Preview">
        <SegmentedControlItem
          value="preview"
          label="Preview"
          isLabelHidden
          icon={<Icon icon={EyeIcon} size="sm" />}
        />
      </Tooltip>
      <Tooltip content="Edit markdown">
        <SegmentedControlItem
          value="edit"
          label="Edit"
          isLabelHidden
          icon={<Icon icon={PencilSquareIcon} size="sm" />}
        />
      </Tooltip>
    </SegmentedControl>
  );
}
