import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { createEditor, type LexicalEditor } from "lexical";
import { WRITE_NODES } from "./nodes.tsx";
import { markdownBody } from "./splice.ts";
import { WRITE_TRANSFORMERS } from "./transformers.ts";

/** Fills the editor from a Document's markdown. Call inside an editor update. */
export const $loadMarkdown = (markdown: string): void => {
  $convertFromMarkdownString(markdownBody(markdown), WRITE_TRANSFORMERS);
};

/** The editor's content as markdown, normalized. Call inside an editor read or update. */
export const $exportMarkdown = (): string => $convertToMarkdownString(WRITE_TRANSFORMERS);

/**
 * An editor with no DOM, for reading a Document the way Write mode will: the
 * markdown it exports is the baseline an edit is diffed against.
 */
export function createHeadlessEditor(): LexicalEditor {
  return createEditor({
    namespace: "mdreadr-write-headless",
    nodes: WRITE_NODES,
    onError: (error) => {
      throw error;
    },
  });
}

/** Loads `markdown` and returns what the editor exports for it. */
export function normalizeThroughEditor(markdown: string, editor = createHeadlessEditor()): string {
  let exported = "";
  editor.update(
    () => {
      $loadMarkdown(markdown);
      exported = $exportMarkdown();
    },
    { discrete: true },
  );
  return exported;
}
