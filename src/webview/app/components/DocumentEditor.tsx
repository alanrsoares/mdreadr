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
};

export const DocumentEditor = ({ value, onChange }: DocumentEditorProps) => {
  const { mode } = useTheme();
  const isDark = mode === "dark";
  const { editorFontSize, editorFontFamily } = useFontSettings();
  const fontFamily = getEditorFontFamilyCss(editorFontFamily);

  const editorTheme = useMemo(
    () =>
      EditorView.theme(
        {
          "&": {
            backgroundColor: "transparent",
            color: "var(--color-text-primary)",
            fontFamily,
            fontSize: `${editorFontSize}px`,
            border: "1px solid var(--color-border)",
            height: "100%",
            padding: "24px 16px",
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-scroller": {
            overflow: "auto",
            borderTopLeftRadius: "inherit",
            borderTopRightRadius: "inherit",
            borderBottomLeftRadius: "inherit",
            borderBottomRightRadius: "inherit",
          },
          ".cm-gutters": {
            backgroundColor: "color-mix(in srgb, var(--color-background-surface) 50%, transparent)",
            color: "var(--color-text-disabled)",
            borderRight: "1px solid var(--color-border)",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "color-mix(in srgb, var(--color-background-surface) 80%, transparent)",
            color: "var(--color-text-primary)",
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
    <ReaderEditor style={{ fontFamily }}>
      <CodeMirror
        value={value}
        height="100%"
        extensions={[markdown(), editorTheme]}
        onChange={onChange}
        theme={isDark ? "dark" : "light"}
      />
    </ReaderEditor>
  );
};
