import { HStack } from "@astryxdesign/core/HStack";
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
  chromeEnd?: ReactNode;
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
  chromeEnd,
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
            <FontAdjustmentControl viewMode={viewMode} />
            {chromeEnd}
          </HStack>
        </ReaderChromeEnd>
      </ReaderDocumentChrome>

      <ReaderDocumentBody className="reader-document-body p-0" key={viewMode}>
        {viewMode === "preview" ? (
          <div className="px-4 py-4 sm:px-6 sm:py-6 md:px-8" style={readerStyles}>
            <MarkdownView
              content={content}
              documentPath={documentPath}
              notes={notes}
              onPinBlock={onPinBlock}
            />
          </div>
        ) : (
          <DocumentEditor value={editorValue} onChange={onEditorChange} />
        )}
      </ReaderDocumentBody>
    </ReaderSheet>
  );
};
