import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import type { SVGProps } from "react";

export type DocumentViewMode = "preview" | "source";

function PreviewModeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; segment label names the mode
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}

function SourceModeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; segment label names the mode
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
      />
    </svg>
  );
}

type DocumentViewModeSwitchProps = {
  value: DocumentViewMode;
  onChange: (mode: DocumentViewMode) => void;
};

export function DocumentViewModeSwitch({ value, onChange }: DocumentViewModeSwitchProps) {
  const selectMode = (next: string) => {
    if (next === "preview" || next === "source") {
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
          icon={<Icon icon={PreviewModeIcon} size="sm" />}
        />
      </Tooltip>
      <Tooltip content="Source markdown">
        <SegmentedControlItem
          value="source"
          label="Source markdown"
          isLabelHidden
          icon={<Icon icon={SourceModeIcon} size="sm" />}
        />
      </Tooltip>
    </SegmentedControl>
  );
}
