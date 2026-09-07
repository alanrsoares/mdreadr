import { useTheme } from "@astryxdesign/core/theme";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";
import { getEditorFontFamilyCss, useFontSettings } from "../theme/FontSettingsContext.tsx";
import { ReaderEditor } from "../ui/reader.tsx";

type DocumentEditorProps = {
  value: string;
  onChange: (text: string) => void;
  /** Handed the live EditorView so callers can drive scrolling (outline jumps). */
  onEditorReady?: (view: EditorView) => void;
};

export const DocumentEditor = ({ value, onChange, onEditorReady }: DocumentEditorProps) => {
  const { mode } = useTheme();
  const isDark = mode === "dark";
  const { editorFontSize, editorFontFamily } = useFontSettings();
  const fontFamily = getEditorFontFamilyCss(editorFontFamily);

  const editorTheme = useMemo(
    () =>
      EditorView.theme(
        {
          // No border, no background, no padding of its own: the editor is the
          // same sheet of paper the prose was on, so the toggle changes the
          // typeface and nothing else. Column and padding come from
          // `ReaderColumn`, shared with Preview.
          "&": {
            backgroundColor: "transparent",
            color: "var(--color-text-primary)",
            fontFamily,
            fontSize: `${editorFontSize}px`,
            height: "100%",
          },
          ".cm-content": {
            fontSize: `${editorFontSize}px`,
            padding: 0,
            // Same measure law as the prose: the source column is capped in ems
            // of its own font size, not left to run the width of the window.
            maxWidth: "var(--reader-editor-measure)",
          },
          ".cm-line": {
            padding: 0,
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-scroller": {
            overflow: "auto",
            // Same leading as the prose, so the two modes scroll at the same
            // rate and a line lands near where its rendered block was.
            lineHeight: "var(--reader-line-height, 1.7)",
          },

          ".cm-activeLine": {
            backgroundColor: "color-mix(in srgb, var(--color-text-accent) 4%, transparent)",
          },
          ".cm-cursor": {
            borderLeftColor: "var(--color-text-primary)",
          },
          ".cm-selectionBackground": {
            backgroundColor: "color-mix(in srgb, var(--color-text-accent) 25%, transparent)",
          },
        },
        { dark: isDark },
      ),
    [isDark, editorFontSize, fontFamily],
  );

  return (
    <ReaderEditor
      style={{
        fontFamily,
        fontSize: `${editorFontSize}px`,
      }}
    >
      <CodeMirror
        value={value}
        height="100%"
        // Line numbers and fold arrows would push the source off the x the
        // prose sat on, and this is a reader with editing, not an IDE.
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true }}
        extensions={[markdown(), EditorView.lineWrapping, editorTheme]}
        onCreateEditor={onEditorReady}
        onChange={onChange}
        theme={isDark ? "dark" : "light"}
      />
    </ReaderEditor>
  );
};
