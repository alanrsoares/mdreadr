import { HStack } from "@astryxdesign/core/HStack";
import type { EditorView } from "@codemirror/view";
import type { BlockAnchor, Note } from "@mdreadr/domain";
import { type CSSProperties, type ReactNode, useRef } from "react";
import { useReaderBlockNavigation } from "../hooks/useReaderBlockNavigation.ts";
import { getReaderFontFamilyCss, useFontSettings } from "../theme/FontSettingsContext.tsx";
import { getReaderMeasurePx } from "../theme/measure.ts";
import {
  ReaderChromeControls,
  ReaderChromeEnd,
  ReaderColumn,
  ReaderDocumentBody,
  ReaderDocumentChrome,
  ReaderSheet,
} from "../ui/layout.tsx";
import { DocumentEditor } from "./DocumentEditor.tsx";
import { type DocumentViewMode, DocumentViewModeSwitch } from "./DocumentViewModeSwitch.tsx";
import { FontAdjustmentControl } from "./FontAdjustmentControl.tsx";
import { MarkdownView } from "./MarkdownView.tsx";

export type { DocumentViewMode };

type DocumentViewProps = {
  content: string;
  notes: Note[];
  documentPath?: string;
  viewMode: DocumentViewMode;
  onViewModeChange: (mode: DocumentViewMode) => void;
  onPinBlock?: (anchor: BlockAnchor) => void;
  onEditBlock?: (anchor: BlockAnchor, newMarkdown: string) => void;
  editorValue: string;
  onEditorChange: (text: string) => void;
  onEditorReady?: (view: EditorView) => void;
  chromeEnd?: ReactNode;
  /** False for a mounted-but-hidden tab; gates the window-level Cmd+± shortcut. */
  isActive?: boolean;
};

export const DocumentView = ({
  content,
  notes,
  documentPath,
  viewMode,
  onViewModeChange,
  onPinBlock,
  onEditBlock,
  editorValue,
  onEditorChange,
  onEditorReady,
  chromeEnd,
  isActive = true,
}: DocumentViewProps) => {
  const { readerFontSize, readerFontFamily, readerLineHeight, editorFontSize, editorFontFamily } =
    useFontSettings();
  const readerFontFamilyCss = getReaderFontFamilyCss(readerFontFamily);
  const previewRef = useRef<HTMLDivElement>(null);

  useReaderBlockNavigation(previewRef, isActive && viewMode === "preview");

  const readerStyles = {
    "--text-body-size": `${readerFontSize}px`,
    "--reader-line-height": readerLineHeight,
    "--text-body-leading": readerLineHeight,
    "--reader-prose-family": readerFontFamilyCss,
    // Scoped to the prose, not `--font-family-heading`: that token also drives
    // astryx chrome rendered inside the preview (pin controls, empty states).
    "--reader-heading-family": readerFontFamilyCss,
    // Code tracks the reader size instead of staying pinned at the 14px base.
    "--text-code-size": `${Math.round(readerFontSize * 0.9)}px`,
    "--reader-measure": `${getReaderMeasurePx(readerFontSize, readerFontFamily)}px`,
    // Same law for the source column, in ems of the editor's own font size.
    "--reader-editor-measure": `${getReaderMeasurePx(editorFontSize, editorFontFamily)}px`,
  } as CSSProperties;

  return (
    <ReaderSheet className="reader-sheet-enter">
      <ReaderDocumentChrome>
        <ReaderChromeControls>
          <DocumentViewModeSwitch value={viewMode} onChange={onViewModeChange} />
        </ReaderChromeControls>
        <ReaderChromeEnd>
          <HStack gap={2} vAlign="center">
            <FontAdjustmentControl viewMode={viewMode} isActive={isActive} />
            {chromeEnd}
          </HStack>
        </ReaderChromeEnd>
      </ReaderDocumentChrome>

      {/* No `key={viewMode}`: keying here remounts the whole body on every
          toggle, which replays the enter animation and reads as a flash. */}
      <ReaderDocumentBody className="reader-document-body">
        {viewMode === "preview" ? (
          <ReaderColumn ref={previewRef} style={readerStyles}>
            <MarkdownView
              content={content}
              documentPath={documentPath}
              notes={notes}
              onPinBlock={onPinBlock}
              onEditBlock={onEditBlock}
            />
          </ReaderColumn>
        ) : (
          <ReaderColumn style={readerStyles}>
            <DocumentEditor
              value={editorValue}
              onChange={onEditorChange}
              onEditorReady={onEditorReady}
            />
          </ReaderColumn>
        )}
      </ReaderDocumentBody>
    </ReaderSheet>
  );
};
