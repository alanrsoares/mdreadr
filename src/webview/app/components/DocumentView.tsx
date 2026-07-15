import type { BlockAnchor, Note } from "@mdreadr/domain";
import {
  ReaderChromeControls,
  ReaderDocumentBody,
  ReaderDocumentChrome,
  ReaderSheet,
} from "../ui/layout.tsx";
import { DocumentViewModeSwitch, type DocumentViewMode } from "./DocumentViewModeSwitch.tsx";
import { MarkdownView } from "./MarkdownView.tsx";
import { RawMarkdownView } from "./RawMarkdownView.tsx";

export type { DocumentViewMode };

type DocumentViewProps = {
  content: string;
  notes: Note[];
  viewMode: DocumentViewMode;
  onViewModeChange: (mode: DocumentViewMode) => void;
  onPinBlock?: (anchor: BlockAnchor) => void;
};

export function DocumentView({
  content,
  notes,
  viewMode,
  onViewModeChange,
  onPinBlock,
}: DocumentViewProps) {
  return (
    <ReaderSheet>
      <ReaderDocumentChrome>
        <ReaderChromeControls>
          <DocumentViewModeSwitch value={viewMode} onChange={onViewModeChange} />
        </ReaderChromeControls>
      </ReaderDocumentChrome>

      <ReaderDocumentBody className="reader-document-body" key={viewMode}>
        {viewMode === "preview" ? (
          <MarkdownView content={content} notes={notes} onPinBlock={onPinBlock} />
        ) : (
          <RawMarkdownView content={content} />
        )}
      </ReaderDocumentBody>
    </ReaderSheet>
  );
}
