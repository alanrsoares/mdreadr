import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import type { EditorState, EditorThemeClasses } from "lexical";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAssetResolver } from "../markdown/assets.ts";
import { SYNTAX_SLOTS } from "../theme/syntax-slots.ts";
import { getApiBase } from "../treaty.ts";
import { $exportMarkdown, $loadMarkdown } from "./bridge.ts";
import { slotClass } from "./code-highlight.ts";
import { registerCodeHighlight } from "./code-highlight-register.ts";
import { ImageSrcContext, WRITE_NODES } from "./nodes.tsx";
import { WRITE_TRANSFORMERS } from "./transformers.ts";
import {
  applyWriteEdit,
  type PendingEmits,
  receiveDraft,
  startWriteSync,
  type WriteSync,
} from "./write-sync.ts";
import "./write-editor.css";

/** Registers highlighting for the composer's editor. */
function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => registerCodeHighlight(editor), [editor]);
  return null;
}

const theme: EditorThemeClasses = {
  paragraph: "write-paragraph",
  quote: "write-quote",
  code: "write-code",
  link: "write-link",
  heading: {
    h1: "write-h1",
    h2: "write-h2",
    h3: "write-h3",
    h4: "write-h4",
    h5: "write-h5",
    h6: "write-h6",
  },
  list: {
    ul: "write-list",
    ol: "write-list",
    listitem: "write-item",
    listitemChecked: "write-item write-item-checked",
    listitemUnchecked: "write-item write-item-unchecked",
    nested: { listitem: "write-item-nested" },
    checklist: "write-checklist",
  },
  codeHighlight: Object.fromEntries(SYNTAX_SLOTS.map((slot) => [slot, slotClass(slot)])),
  table: "write-table",
  tableRow: "write-row",
  tableCell: "write-cell",
  tableCellHeader: "write-cell-header",
};

type WriteEditorProps = {
  /** The Draft. The editor reads it when it opens and whenever it changes from outside. */
  value: string;
  documentPath?: string;
  /** The Draft after an edit: the original with only the changed blocks rewritten. */
  onChange: (text: string) => void;
};

/** Replaces the editor's content when the Draft changes from outside, as one undoable step. */
type ExternalDraftProps = {
  value: string;
  syncRef: RefObject<WriteSync>;
  pendingRef: RefObject<PendingEmits>;
};

/** Loads Draft changes made outside Write into the editor as one undoable update. */
function ExternalDraftPlugin({ value, syncRef, pendingRef }: ExternalDraftProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const arrival = receiveDraft(pendingRef.current, value);
    pendingRef.current = arrival.pending;
    if (!arrival.external || value === syncRef.current.markdown) return;

    editor.update(() => {
      $loadMarkdown(value);
      syncRef.current = startWriteSync(value, $exportMarkdown());
    });
  }, [editor, value, syncRef, pendingRef]);

  return null;
}

/**
 * The Write surface: the Draft as formatted blocks. The Draft is still the
 * markdown string; the editor imports it on open and hands back a new string
 * only when the reader edits.
 *
 * A Draft that changed from somewhere other than this editor (accepting a
 * Suggestion, say) is loaded into the same editor as an ordinary update, so the
 * undo history survives and undo steps back over it.
 */
export function WriteEditor({ value, documentPath, onChange }: WriteEditorProps) {
  const syncRef = useRef<WriteSync>(startWriteSync(value, ""));
  const pendingRef = useRef<PendingEmits>([]);
  const resolveImageSrc = useMemo(
    () => createAssetResolver(getApiBase(), documentPath),
    [documentPath],
  );

  // Read once by the composer. The editor opens on the Draft, and what it
  // exports for it is the baseline every later edit is measured against.
  const [initialConfig] = useState(() => ({
    namespace: "mdreadr-write",
    nodes: WRITE_NODES,
    theme,
    onError: (error: Error) => {
      throw error;
    },
    editorState: () => {
      $loadMarkdown(value);
      syncRef.current = startWriteSync(value, $exportMarkdown());
    },
  }));

  const onEditorChange = useCallback(
    (state: EditorState) => {
      const exported = state.read($exportMarkdown);
      const edit = applyWriteEdit(syncRef.current, exported);
      syncRef.current = edit.sync;
      if (!edit.changed) return;
      pendingRef.current = [...pendingRef.current, edit.sync.markdown];
      onChange(edit.sync.markdown);
    },
    [onChange],
  );

  return (
    <ImageSrcContext.Provider value={resolveImageSrc}>
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="write-editor reader-prose"
              aria-label="Write Document"
              spellCheck
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <CodeHighlightPlugin />
        <ExternalDraftPlugin value={value} syncRef={syncRef} pendingRef={pendingRef} />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <TablePlugin />
        <HorizontalRulePlugin />
        <HistoryPlugin />
        <MarkdownShortcutPlugin transformers={WRITE_TRANSFORMERS} />
        <OnChangePlugin ignoreSelectionChange onChange={onEditorChange} />
      </LexicalComposer>
    </ImageSrcContext.Provider>
  );
}
