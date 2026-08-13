import { HStack } from "@astryxdesign/core/HStack";
import type { EditorView } from "@codemirror/view";
import type { BlockAnchor, Note } from "@mdreadr/domain";
import type { CSSProperties, ReactNode } from "react";
import { getReaderFontFamilyCss, useFontSettings } from "../theme/FontSettingsContext.tsx";
import {
  ReaderChromeControls,
  ReaderChromeEnd,
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
  editorValue,
  onEditorChange,
  onEditorReady,
  chromeEnd,
  isActive = true,
}: DocumentViewProps) => {
  const { readerFontSize, readerFontFamily } = useFontSettings();
  const readerFontFamilyCss = getReaderFontFamilyCss(readerFontFamily);

  const readerStyles = {
    "--text-body-size": `${readerFontSize}px`,
    "--reader-prose-family": readerFontFamilyCss,
    "--font-family-heading": readerFontFamilyCss,
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

      <ReaderDocumentBody className="reader-document-body" key={viewMode}>
        {viewMode === "preview" ? (
          <div className="px-4 pt-4 pb-12 sm:px-6 sm:pt-6 sm:pb-14 md:px-8" style={readerStyles}>
            <MarkdownView
              content={content}
              documentPath={documentPath}
              notes={notes}
              onPinBlock={onPinBlock}
            />
          </div>
        ) : (
          <DocumentEditor
            value={editorValue}
            onChange={onEditorChange}
            onEditorReady={onEditorReady}
          />
        )}
      </ReaderDocumentBody>
    </ReaderSheet>
  );
};
