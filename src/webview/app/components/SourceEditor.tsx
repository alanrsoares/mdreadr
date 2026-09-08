import { useTheme } from "@astryxdesign/core/theme";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { type CSSProperties, forwardRef, useImperativeHandle, useMemo, useRef } from "react";

/** Character offsets into the source, the same shape `inline-edit-ops` uses. */
export type SourceSelection = { start: number; end: number };

/**
 * What a caller needs to drive the editor from outside: a formatting toolbar
 * reads the value and the selection, writes both back, and returns focus.
 */
export type SourceEditorHandle = {
  getValue: () => string;
  getSelection: () => SourceSelection;
  setSelection: (selection: SourceSelection) => void;
  focus: () => void;
};

export type SourceEditorProps = {
  value: string;
  onChange: (text: string) => void;
  /**
   * `"fill"` takes the height of its container, for the document well.
   * `"content"` grows with the text, for a block fragment that must not be
   * taller than the block it replaced.
   */
  sizing: "fill" | "content";
  /** Typography of the surface the source is standing in for. */
  typography: CSSProperties;
  /** Caps the source column, so it wraps where the rendered text wrapped. */
  maxWidth?: string;
  hasActiveLine?: boolean;
  hasSpellCheck?: boolean;
  ariaLabel?: string;
  onCreateEditor?: (view: EditorView) => void;
};

/**
 * The one CodeMirror in the app. Both the whole-document editor and the inline
 * block editor are this component with different sizing and typography, so
 * they cannot drift apart on theme, measure or keyboard behaviour.
 *
 * Everything visual is off by default: no border, no background, no padding,
 * no gutter. The editor has to read as the same sheet of paper the prose was
 * on, which is also what keeps swapping a block for its source from moving it.
 */
export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(function SourceEditor(
  {
    value,
    onChange,
    sizing,
    typography,
    maxWidth,
    hasActiveLine = false,
    hasSpellCheck = false,
    ariaLabel,
    onCreateEditor,
  },
  ref,
) {
  const { mode } = useTheme();
  const isDark = mode === "dark";
  const viewRef = useRef<EditorView | null>(null);

  useImperativeHandle(
    ref,
    (): SourceEditorHandle => ({
      getValue: () => viewRef.current?.state.doc.toString() ?? "",
      getSelection: () => {
        const main = viewRef.current?.state.selection.main;
        return { start: main?.from ?? 0, end: main?.to ?? 0 };
      },
      setSelection: ({ start, end }) => {
        const view = viewRef.current;
        if (!view) return;
        // Clamp: an edit can shorten the document below the offsets the
        // caller computed against the previous text.
        const max = view.state.doc.length;
        view.dispatch({
          selection: { anchor: Math.min(start, max), head: Math.min(end, max) },
        });
      },
      focus: () => viewRef.current?.focus(),
    }),
    [],
  );

  const editorTheme = useMemo(
    () =>
      EditorView.theme(
        {
          "&": {
            backgroundColor: "transparent",
            color: "var(--color-text-primary)",
            ...(sizing === "fill" ? { height: "100%" } : {}),
          },
          ".cm-content": {
            padding: 0,
            ...(maxWidth ? { maxWidth } : {}),
            caretColor: "var(--color-text-accent)",
          },
          ".cm-line": { padding: 0 },
          "&.cm-focused": { outline: "none" },
          ".cm-scroller": {
            // A fragment must not scroll: it grows instead, or the block it
            // replaced would gain a scrollbar and a fixed height.
            overflow: sizing === "fill" ? "auto" : "visible",
            lineHeight: "inherit",
            fontFamily: "inherit",
          },
          ".cm-activeLine": {
            backgroundColor: hasActiveLine
              ? "color-mix(in srgb, var(--color-text-accent) 4%, transparent)"
              : "transparent",
          },
          ".cm-cursor": { borderLeftColor: "var(--color-text-primary)" },
          ".cm-selectionBackground": {
            backgroundColor: "color-mix(in srgb, var(--color-text-accent) 25%, transparent)",
          },
        },
        { dark: isDark },
      ),
    [isDark, sizing, maxWidth, hasActiveLine],
  );

  return (
    <CodeMirror
      value={value}
      style={typography}
      {...(sizing === "fill" ? { height: "100%" } : {})}
      // Line numbers and fold arrows would push the source off the x the
      // prose sat on, and this is a reader with editing, not an IDE.
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: hasActiveLine,
      }}
      // Tab is owned by the caller: in the inline editor it runs the tested
      // `indent` / `outdent` ops, and in the toolbar it still moves focus out.
      indentWithTab={false}
      extensions={[markdown(), EditorView.lineWrapping, editorTheme]}
      onCreateEditor={(view) => {
        viewRef.current = view;
        if (ariaLabel) view.contentDOM.setAttribute("aria-label", ariaLabel);
        view.contentDOM.spellcheck = hasSpellCheck;
        onCreateEditor?.(view);
      }}
      onChange={onChange}
      theme={isDark ? "dark" : "light"}
    />
  );
});
