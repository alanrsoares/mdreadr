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
import {
  clampFontSize,
  FONT_SIZE_STEP,
  LINE_HEIGHT_STEP,
  MAX_FONT_SIZE,
  MAX_LINE_HEIGHT,
  MIN_FONT_SIZE,
  MIN_LINE_HEIGHT,
} from "../theme/font-settings-container.ts";
import type { DocumentViewMode } from "./DocumentViewModeSwitch.tsx";

type FontAdjustmentControlProps = {
  viewMode?: DocumentViewMode;
  /**
   * Every tab stays mounted, so without this each one would register its own
   * Cmd+± listener and the shortcut would fire once per open tab.
   */
  isActive?: boolean;
};

export function FontAdjustmentControl({
  viewMode = "preview",
  isActive = true,
}: FontAdjustmentControlProps) {
  const {
    readerFontSize,
    readerFontFamily,
    readerLineHeight,
    editorFontSize,
    editorFontFamily,
    setReaderFontSize,
    setReaderFontFamily,
    setReaderLineHeight,
    setEditorFontSize,
    setEditorFontFamily,
    resetDefaults,
  } = useFontSettings();

  const isEdit = viewMode === "edit";
  const currentSize = isEdit ? editorFontSize : readerFontSize;
  const surface = isEdit ? "editor" : "reader";

  // The setters clamp; these keep the labels honest at the bounds.
  const nextSizeDown = clampFontSize(currentSize - FONT_SIZE_STEP);
  const nextSizeUp = clampFontSize(currentSize + FONT_SIZE_STEP);

  const setCurrentSize = useCallback(
    (size: number) => (isEdit ? setEditorFontSize(size) : setReaderFontSize(size)),
    [isEdit, setEditorFontSize, setReaderFontSize],
  );

  const handleDecrease = useCallback(() => {
    setCurrentSize(currentSize - FONT_SIZE_STEP);
  }, [currentSize, setCurrentSize]);

  const handleIncrease = useCallback(() => {
    setCurrentSize(currentSize + FONT_SIZE_STEP);
  }, [currentSize, setCurrentSize]);

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

  const handleReaderLineHeightChange = (val: number | [number, number]) => {
    if (typeof val === "number") {
      setReaderLineHeight(val);
    }
  };

  const handleEditorSizeChange = (val: number | [number, number]) => {
    if (typeof val === "number") {
      setEditorFontSize(val);
    }
  };

  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      // Cmd+± are not text-entry keys, so the editor is *the* place the
      // shortcut has to work — bailing on contenteditable disabled it exactly
      // in edit mode and let webview zoom take the keystroke instead. Only
      // plain form fields (find bars, dialogs) still opt out.
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) {
        return;
      }

      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        handleIncrease();
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        handleDecrease();
      } else if (event.key === "0") {
        event.preventDefault();
        resetDefaults();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isActive, handleIncrease, handleDecrease, resetDefaults]);

  return (
    <HStack
      gap={0.5}
      vAlign="center"
      className="rounded-(--radius-container) border border-(--color-border) bg-(--color-background-surface) p-0.5 shadow-xs"
    >
      <Tooltip content={`Decrease ${surface} font size (${nextSizeDown}px)`}>
        <IconButton
          label={`Decrease ${surface} font size`}
          variant="ghost"
          size="sm"
          isDisabled={currentSize <= MIN_FONT_SIZE}
          icon={
            <span className="select-none font-semibold text-(--color-text-secondary) text-xs transition-colors hover:text-(--color-text-primary)">
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
              <Tooltip content="Reset font settings (⌘0)">
                <Button
                  label="Reset font settings"
                  variant="ghost"
                  size="sm"
                  onClick={resetDefaults}
                >
                  Reset
                </Button>
              </Tooltip>
            </HStack>

            <Divider />

            <VStack gap={2}>
              <Text type="supporting" color="secondary" weight="semibold">
                Reader (Preview)
              </Text>
              {/* Slider renders its own label — a Field wrapper would print it twice. */}
              <Slider
                label="Font Size"
                width="100%"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                step={FONT_SIZE_STEP}
                value={readerFontSize}
                onChange={handleReaderSizeChange}
                formatValue={(v) => `${v}px`}
                valueDisplay="text"
              />
              <Slider
                label="Line Height"
                width="100%"
                min={MIN_LINE_HEIGHT}
                max={MAX_LINE_HEIGHT}
                step={LINE_HEIGHT_STEP}
                value={readerLineHeight}
                onChange={handleReaderLineHeightChange}
                formatValue={(v) => v.toFixed(2)}
                valueDisplay="text"
              />
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
              <Slider
                label="Font Size"
                width="100%"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                step={FONT_SIZE_STEP}
                value={editorFontSize}
                onChange={handleEditorSizeChange}
                formatValue={(v) => `${v}px`}
                valueDisplay="text"
              />
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
        <Tooltip content={`Font settings — ${surface} at ${currentSize}px (⌘+ / ⌘- / ⌘0)`}>
          <Button label={`Font settings, ${surface} at ${currentSize}px`} variant="ghost" size="sm">
            <span className="flex select-none items-center gap-1.5 font-semibold text-xs">
              <span className="font-serif text-sm">aA</span>
              <span className="font-sans text-(--color-text-secondary) text-[11px]">
                {currentSize}px
              </span>
            </span>
          </Button>
        </Tooltip>
      </Popover>

      <Tooltip content={`Increase ${surface} font size (${nextSizeUp}px)`}>
        <IconButton
          label={`Increase ${surface} font size`}
          variant="ghost"
          size="sm"
          isDisabled={currentSize >= MAX_FONT_SIZE}
          icon={
            <span className="select-none font-semibold text-(--color-text-secondary) text-sm transition-colors hover:text-(--color-text-primary)">
              A+
            </span>
          }
          onClick={handleIncrease}
        />
      </Tooltip>
    </HStack>
  );
}
