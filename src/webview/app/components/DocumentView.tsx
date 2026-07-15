import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import type { BlockAnchor } from "@mdreadr/domain";
import { useEffect, useState } from "react";
import { ReaderToolbar } from "../ui/layout.tsx";
import { MarkdownView } from "./MarkdownView.tsx";
import { RawMarkdownView } from "./RawMarkdownView.tsx";

export type DocumentViewMode = "preview" | "source";

type DocumentViewProps = {
  content: string;
  onPinBlock?: (anchor: BlockAnchor) => void;
  onViewModeChange?: (mode: DocumentViewMode) => void;
};

export function DocumentView({ content, onPinBlock, onViewModeChange }: DocumentViewProps) {
  const [viewMode, setViewMode] = useState<DocumentViewMode>("preview");

  useEffect(() => {
    onViewModeChange?.(viewMode);
  }, [viewMode, onViewModeChange]);

  const selectMode = (next: string) => {
    if (next === "preview" || next === "source") {
      setViewMode(next);
    }
  };

  return (
    <>
      <ReaderToolbar>
        <SegmentedControl
          label="Preview or source"
          layout="fill"
          value={viewMode}
          onChange={selectMode}
        >
          <SegmentedControlItem label="Preview" value="preview" />
          <SegmentedControlItem label="Source" value="source" />
        </SegmentedControl>
      </ReaderToolbar>

      {viewMode === "preview" ? (
        <MarkdownView content={content} onPinBlock={onPinBlock} />
      ) : (
        <RawMarkdownView content={content} />
      )}
    </>
  );
}
