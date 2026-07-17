import { useTheme } from "@astryxdesign/core/theme";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { ReaderEditor } from "../ui/reader.tsx";

type DocumentEditorProps = {
  value: string;
  onChange: (text: string) => void;
};

export const DocumentEditor = ({ value, onChange }: DocumentEditorProps) => {
  const { mode } = useTheme();
  const isDark = mode === "dark";

  const editorTheme = EditorView.theme(
    {
      "&": {
        backgroundColor: "transparent",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-family-code)",
        fontSize: "0.95rem",
        borderRadius: "var(--radius-container)",
        border: "1px solid var(--color-border)",
        minHeight: "70vh",
      },
      "&.cm-focused": {
        outline: "none",
        borderColor: "var(--color-text-accent)",
        boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-text-accent) 20%, transparent)",
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
  );

  return (
    <ReaderEditor>
      <CodeMirror
        value={value}
        extensions={[markdown(), editorTheme]}
        onChange={onChange}
        theme={isDark ? "dark" : "light"}
      />
    </ReaderEditor>
  );
};
