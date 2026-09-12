import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import type { EditorView } from "@codemirror/view";
import { type BlockAnchor, type DocumentKind, documentStats, type Note } from "@mdreadr/domain";
import { match } from "@onrails/pattern";
import { type CSSProperties, type ReactNode, type RefObject, useMemo, useRef } from "react";
import { useReaderBlockNavigation } from "../hooks/useReaderBlockNavigation.ts";
import { getReaderFontFamilyCss, useFontSettings } from "../theme/FontSettingsContext.tsx";
import { getReaderMeasurePx } from "../theme/measure.ts";
import {
  ReaderChromeControls,
  ReaderChromeEnd,
  ReaderChromeStart,
  ReaderColumn,
  ReaderDocumentBody,
  ReaderDocumentChrome,
  ReaderSheet,
} from "../ui/layout.tsx";
import { DocumentEditor } from "./DocumentEditor.tsx";
import { type DocumentViewMode, DocumentViewModeSwitch } from "./DocumentViewModeSwitch.tsx";
import { FontAdjustmentControl } from "./FontAdjustmentControl.tsx";
import { ImageDocumentView } from "./ImageDocumentView.tsx";
import { MarkdownView } from "./MarkdownView.tsx";
import { fileSource, plainSource } from "./source-language.ts";

export type { DocumentViewMode };

type DocumentViewProps = {
  content: string;
  notes: Note[];
  documentPath?: string;
  /** Only a markdown Document has a preview to toggle to; the rest open flat. */
  kind?: DocumentKind;
  viewMode: DocumentViewMode;
  onViewModeChange: (mode: DocumentViewMode) => void;
  onPinBlock?: (anchor: BlockAnchor) => void;
  /** Opens another Document in a Tab, for links between markdown files. */
  onOpenDocument?: (path: string) => void;
  editorValue: string;
  onEditorChange: (text: string) => void;
  onEditorReady?: (view: EditorView) => void;
  chromeEnd?: ReactNode;
  /** Floats over the sheet, above the prose it searches. */
  findBar?: ReactNode;
  /** The rendered Document, when a caller needs to read it (find, navigation). */
  previewRef?: RefObject<HTMLDivElement | null>;
  /** False for a mounted-but-hidden tab; gates the window-level Cmd+± shortcut. */
  isActive?: boolean;
};

export const DocumentView = ({
  content,
  notes,
  documentPath,
  kind = "markdown",
  viewMode,
  onViewModeChange,
  onPinBlock,
  onOpenDocument,
  editorValue,
  onEditorChange,
  onEditorReady,
  chromeEnd,
  findBar,
  previewRef: previewRefFromProps,
  isActive = true,
}: DocumentViewProps) => {
  const { readerFontSize, readerFontFamily, readerLineHeight, editorFontSize, editorFontFamily } =
    useFontSettings();
  const readerFontFamilyCss = getReaderFontFamilyCss(readerFontFamily);
  const ownPreviewRef = useRef<HTMLDivElement>(null);
  const previewRef = previewRefFromProps ?? ownPreviewRef;
  // Only markdown owns both modes; the others are pinned to the one they have.
  const mode = match(kind)
    .with("markdown", () => viewMode)
    .with("image", () => "preview" as const)
    .with("source", () => "edit" as const)
    .exhaustive();

  useReaderBlockNavigation(previewRef, isActive && kind === "markdown" && mode === "preview");

  // Off the saved content, not the Draft: a stat that ticked over per keystroke
  // would be motion in the chrome while the reader types.
  const stats = useMemo(() => documentStats(content), [content]);

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

  // An image fits the well instead of growing it: the sheet takes the height of
  // the scroll container, so `max-h-full` on the image has something definite
  // to measure against.
  return (
    <ReaderSheet className={kind === "image" ? "reader-sheet-enter h-full" : "reader-sheet-enter"}>
      <ReaderDocumentChrome>
        {kind === "markdown" ? (
          <ReaderChromeStart>
            <Text type="supporting" size="xsm">
              {stats.words.toLocaleString()} words, {stats.minutes} min
            </Text>
          </ReaderChromeStart>
        ) : null}
        <ReaderChromeControls>
          <DocumentViewModeSwitch value={mode} onChange={onViewModeChange} kind={kind} />
        </ReaderChromeControls>
        <ReaderChromeEnd>
          <HStack gap={2} vAlign="center">
            {kind === "image" ? null : (
              <FontAdjustmentControl viewMode={mode} isActive={isActive} />
            )}
            {chromeEnd}
          </HStack>
        </ReaderChromeEnd>
        {findBar}
      </ReaderDocumentChrome>

      {/* No `key={viewMode}`: keying here remounts the whole body on every
          toggle, which replays the enter animation and reads as a flash. */}
      {/* An image is centred in the well rather than flowing down it, so the
          body becomes the flex parent it needs. */}
      <ReaderDocumentBody
        className={
          kind === "image"
            ? "reader-document-body flex min-h-0 overflow-hidden"
            : "reader-document-body"
        }
      >
        {match(kind)
          .with("image", () =>
            documentPath ? <ImageDocumentView documentPath={documentPath} /> : null,
          )
          .with("source", () => (
            <ReaderColumn style={readerStyles}>
              <DocumentEditor
                value={editorValue}
                onChange={onEditorChange}
                onEditorReady={onEditorReady}
                language={documentPath ? fileSource(documentPath) : plainSource}
              />
            </ReaderColumn>
          ))
          .with("markdown", () =>
            mode === "preview" ? (
              <ReaderColumn ref={previewRef} style={readerStyles}>
                <MarkdownView
                  content={content}
                  documentPath={documentPath}
                  notes={notes}
                  onPinBlock={onPinBlock}
                  onOpenDocument={onOpenDocument}
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
            ),
          )
          .exhaustive()}
      </ReaderDocumentBody>
    </ReaderSheet>
  );
};
