import type { BlockAnchor, Note } from "@mdreadr/domain";
import {
  ReaderChromeControls,
  ReaderDocumentBody,
  ReaderDocumentChrome,
  ReaderSheet,
} from "../ui/layout.tsx";
import { type DocumentViewMode, DocumentViewModeSwitch } from "./DocumentViewModeSwitch.tsx";
import { MarkdownView } from "./MarkdownView.tsx";
import { RawMarkdownView } from "./RawMarkdownView.tsx";

export type { DocumentViewMode };

type DocumentViewProps = {
  content: string;
  notes: Note[];
  documentPath?: string;
  viewMode: DocumentViewMode;
  onViewModeChange: (mode: DocumentViewMode) => void;
  onPinBlock?: (anchor: BlockAnchor) => void;
};

export const DocumentView = ({
  content,
  notes,
  documentPath,
  viewMode,
  onViewModeChange,
  onPinBlock,
}: DocumentViewProps) => (
  <ReaderSheet className="reader-sheet-enter">
    <ReaderDocumentChrome>
      <ReaderChromeControls>
        <DocumentViewModeSwitch value={viewMode} onChange={onViewModeChange} />
      </ReaderChromeControls>
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
        <RawMarkdownView content={content} />
      )}
    </ReaderDocumentBody>
  </ReaderSheet>
);
