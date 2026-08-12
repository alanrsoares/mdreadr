import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Field } from "@astryxdesign/core/Field";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Popover } from "@astryxdesign/core/Popover";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Slider } from "@astryxdesign/core/Slider";
import { Text } from "@astryxdesign/core/Text";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { VStack } from "@astryxdesign/core/VStack";
import { useCallback, useEffect } from "react";
import {
  type EditorFontFamily,
  type ReaderFontFamily,
  useFontSettings,
} from "../theme/FontSettingsContext.tsx";
import type { DocumentViewMode } from "./DocumentViewModeSwitch.tsx";

type FontAdjustmentControlProps = {
  viewMode?: DocumentViewMode;
};

export function FontAdjustmentControl({ viewMode = "preview" }: FontAdjustmentControlProps) {
  const {
    readerFontSize,
    readerFontFamily,
    editorFontSize,
    editorFontFamily,
    setReaderFontSize,
    setReaderFontFamily,
    setEditorFontSize,
    setEditorFontFamily,
    resetDefaults,
  } = useFontSettings();

  const isEdit = viewMode === "edit";
  const currentSize = isEdit ? editorFontSize : readerFontSize;

  const handleDecrease = useCallback(() => {
    if (isEdit) {
      setEditorFontSize(Math.max(12, editorFontSize - 1));
    } else {
      setReaderFontSize(Math.max(12, readerFontSize - 1));
    }
  }, [isEdit, editorFontSize, readerFontSize, setEditorFontSize, setReaderFontSize]);

  const handleIncrease = useCallback(() => {
    if (isEdit) {
      setEditorFontSize(Math.min(24, editorFontSize + 1));
    } else {
      setReaderFontSize(Math.min(24, readerFontSize + 1));
    }
  }, [isEdit, editorFontSize, readerFontSize, setEditorFontSize, setReaderFontSize]);

  const handleReaderFamilyChange = (next: string) => {
    if (next === "serif" || next === "sans" || next === "mono") {
      setReaderFontFamily(next as ReaderFontFamily);
    }
  };

  const handleEditorFamilyChange = (next: string) => {
    if (next === "mono" || next === "sans") {
      setEditorFontFamily(next as EditorFontFamily);
    }
  };

  const handleReaderSizeChange = (val: number | [number, number]) => {
    if (typeof val === "number") {
      setReaderFontSize(val);
    }
  };

  const handleEditorSizeChange = (val: number | [number, number]) => {
    if (typeof val === "number") {
      setEditorFontSize(val);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }

      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        handleIncrease();
      } else if (event.key === "-") {
        event.preventDefault();
        handleDecrease();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleIncrease, handleDecrease]);

  return (
    <HStack
      gap={0.5}
      vAlign="center"
      className="rounded-(--radius-container) border border-(--color-border) bg-(--color-background-surface) p-0.5 shadow-xs"
    >
      <Tooltip content={`Decrease font size (${currentSize - 1}px)`}>
        <IconButton
          label="Decrease font size"
          variant="ghost"
          size="sm"
          isDisabled={currentSize <= 12}
          icon={
            <span className="select-none font-semibold text-(--color-text-secondary) text-xs">
              A-
            </span>
          }
          onClick={handleDecrease}
        />
      </Tooltip>

      <Popover
        placement="below"
        alignment="end"
        label="Font settings"
        width={320}
        content={
          <VStack gap={3} padding={3}>
            <HStack justify="between" vAlign="center">
              <Text type="body" weight="semibold">
                Font Settings
              </Text>
              <Button label="Reset font settings" variant="ghost" size="sm" onClick={resetDefaults}>
                Reset
              </Button>
            </HStack>

            <Divider />

            <VStack gap={2}>
              <Text type="supporting" color="secondary" weight="semibold">
                Reader (Preview)
              </Text>
              <Field label="Font Size" inputID="reader-font-size-slider" width="100%">
                <Slider
                  label="Reader Font Size"
                  min={12}
                  max={24}
                  step={1}
                  value={readerFontSize}
                  onChange={handleReaderSizeChange}
                  formatValue={(v) => `${v}px`}
                  valueDisplay="text"
                />
              </Field>
              <Field label="Font Family" inputID="reader-font-family-segmented" width="100%">
                <SegmentedControl
                  label="Reader font family selection"
                  size="sm"
                  layout="fill"
                  value={readerFontFamily}
                  onChange={handleReaderFamilyChange}
                >
                  <SegmentedControlItem value="serif" label="Serif" />
                  <SegmentedControlItem value="sans" label="Sans" />
                  <SegmentedControlItem value="mono" label="Mono" />
                </SegmentedControl>
              </Field>
            </VStack>

            <Divider />

            <VStack gap={2}>
              <Text type="supporting" color="secondary" weight="semibold">
                Editor (Markdown)
              </Text>
              <Field label="Font Size" inputID="editor-font-size-slider" width="100%">
                <Slider
                  label="Editor Font Size"
                  min={12}
                  max={24}
                  step={1}
                  value={editorFontSize}
                  onChange={handleEditorSizeChange}
                  formatValue={(v) => `${v}px`}
                  valueDisplay="text"
                />
              </Field>
              <Field label="Font Family" inputID="editor-font-family-segmented" width="100%">
                <SegmentedControl
                  label="Editor font family selection"
                  size="sm"
                  layout="fill"
                  value={editorFontFamily}
                  onChange={handleEditorFamilyChange}
                >
                  <SegmentedControlItem value="mono" label="Mono" />
                  <SegmentedControlItem value="sans" label="Sans" />
                </SegmentedControl>
              </Field>
            </VStack>
          </VStack>
        }
      >
        <Tooltip content={`Font settings (${currentSize}px)`}>
          <Button label={`Font settings (${currentSize}px)`} variant="ghost" size="sm">
            <span className="flex select-none items-center gap-1.5 font-semibold text-xs">
              <span className="font-serif text-sm">aA</span>
              <span className="font-sans text-(--color-text-secondary) text-[11px]">
                {currentSize}px
              </span>
            </span>
          </Button>
        </Tooltip>
      </Popover>

      <Tooltip content={`Increase font size (${currentSize + 1}px)`}>
        <IconButton
          label="Increase font size"
          variant="ghost"
          size="sm"
          isDisabled={currentSize >= 24}
          icon={
            <span className="select-none font-semibold text-(--color-text-secondary) text-sm">
              A+
            </span>
          }
          onClick={handleIncrease}
        />
      </Tooltip>
    </HStack>
  );
}
