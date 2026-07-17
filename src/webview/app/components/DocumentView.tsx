import type { BlockAnchor, Note } from "@mdreadr/domain";
import type { ReactNode } from "react";
import {
  ReaderChromeControls,
  ReaderChromeEnd,
  ReaderDocumentBody,
  ReaderDocumentChrome,
  ReaderSheet,
} from "../ui/layout.tsx";
import { DocumentEditor } from "./DocumentEditor.tsx";
import { type DocumentViewMode, DocumentViewModeSwitch } from "./DocumentViewModeSwitch.tsx";
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
}: DocumentViewProps) => (
  <ReaderSheet className="reader-sheet-enter">
    <ReaderDocumentChrome>
      <ReaderChromeControls>
        <DocumentViewModeSwitch value={viewMode} onChange={onViewModeChange} />
      </ReaderChromeControls>
      {chromeEnd ? <ReaderChromeEnd>{chromeEnd}</ReaderChromeEnd> : null}
    </ReaderDocumentChrome>

    <ReaderDocumentBody className="reader-document-body" key={viewMode}>
      {viewMode === "preview" ? (
        <MarkdownView
          content={content}
          documentPath={documentPath}
          notes={notes}
          onPinBlock={onPinBlock}
        />
      ) : (
        <DocumentEditor value={editorValue} onChange={onEditorChange} />
      )}
    </ReaderDocumentBody>
  </ReaderSheet>
);
