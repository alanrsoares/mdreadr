import type { EditorView } from "@codemirror/view";
import { getEditorFontFamilyCss, useFontSettings } from "../theme/FontSettingsContext.tsx";
import { ReaderEditor } from "../ui/reader.tsx";
import { SourceEditor, type SourceLanguage } from "./SourceEditor.tsx";

type DocumentEditorProps = {
  value: string;
  onChange: (text: string) => void;
  /** Handed the live EditorView so callers can drive scrolling (outline jumps). */
  onEditorReady?: (view: EditorView) => void;
  /** `"plain"` for a Document that is not markdown, so nothing is styled as syntax it does not have. */
  language?: SourceLanguage;
};

export const DocumentEditor = ({
  value,
  onChange,
  onEditorReady,
  language = "markdown",
}: DocumentEditorProps) => {
  const { editorFontSize, editorFontFamily } = useFontSettings();
  const fontFamily = getEditorFontFamilyCss(editorFontFamily);

  return (
    <ReaderEditor style={{ fontFamily, fontSize: `${editorFontSize}px` }}>
      <SourceEditor
        value={value}
        onChange={onChange}
        sizing="fill"
        language={language}
        hasActiveLine
        typography={{
          fontFamily,
          fontSize: `${editorFontSize}px`,
          height: "100%",
          // Same leading as the prose, so the two modes scroll at the same rate
          // and a line lands near where the rendered block was.
          lineHeight: "var(--reader-line-height, 1.7)",
        }}
        // Same measure law as the prose: the source column is capped in ems of
        // its own font size, not left to run the width of the window.
        maxWidth="var(--reader-editor-measure)"
        onCreateEditor={onEditorReady}
      />
    </ReaderEditor>
  );
};
