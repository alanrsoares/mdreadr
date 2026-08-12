import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Field } from "@astryxdesign/core/Field";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Popover } from "@astryxdesign/core/Popover";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Slider } from "@astryxdesign/core/Slider";
import { Text } from "@astryxdesign/core/Text";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { VStack } from "@astryxdesign/core/VStack";
import { AdjustmentsHorizontalIcon } from "../icons.ts";
import {
  type EditorFontFamily,
  type ReaderFontFamily,
  useFontSettings,
} from "../theme/FontSettingsContext.tsx";

export function FontAdjustmentControl() {
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

  return (
    <Popover
      placement="below"
      alignment="center"
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
      <Tooltip content="Font settings">
        <IconButton
          label="Font settings"
          variant="ghost"
          size="sm"
          icon={<Icon icon={AdjustmentsHorizontalIcon} size="sm" />}
        />
      </Tooltip>
    </Popover>
  );
}
