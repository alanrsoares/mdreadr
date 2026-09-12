import { CodeBlock, type CodeBlockProps } from "@astryxdesign/core/CodeBlock";
import { syntaxTokenizer } from "./syntax-tokens.ts";

/**
 * astryx's CodeBlock with refractor grammars wired into its `tokenizer` hook.
 * Every fence in the reader goes through here so one engine highlights them
 * all; the bare component only ships javascript and css.
 *
 * `highlightMode` is left on `auto` on purpose: the Highlight API path is
 * skipped on WebKit, which is exactly the engine the app's webview runs.
 */
export function ReaderCodeBlock(props: CodeBlockProps) {
  return <CodeBlock {...props} tokenizer={syntaxTokenizer} />;
}
