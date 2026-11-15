import { $createCodeHighlightNode, $isCodeHighlightNode, CodeNode } from "@lexical/code";
import {
  $createLineBreakNode,
  $createTabNode,
  $getSelection,
  $isLineBreakNode,
  $isRangeSelection,
  $isTabNode,
  $isTextNode,
  type LexicalEditor,
  type LexicalNode,
  type PointType,
  tokenizeRawText,
} from "lexical";
import { highlightSegments } from "./code-highlight.ts";

/** One child of a code block: a run of text with its slot, a line break, or a tab. */
export type CodePart =
  | { kind: "text"; text: string; slot: string | null }
  | { kind: "break" }
  | { kind: "tab" };

/** The children a code block should have for `code`: text runs split at line breaks and tabs. */
export function codeParts(code: string, language: string | undefined): CodePart[] {
  return highlightSegments(code, language).flatMap(({ text, slot }) => {
    const parts: CodePart[] = [];
    tokenizeRawText(text, {
      linebreak: () => parts.push({ kind: "break" }),
      tab: () => parts.push({ kind: "tab" }),
      text: (part) => parts.push({ kind: "text", text: part, slot }),
    });
    return parts;
  });
}

/** The highlightable piece a code child contributes, or undefined for anything else. */
const partOf = (node: LexicalNode): CodePart | undefined => {
  if ($isCodeHighlightNode(node)) {
    return { kind: "text", text: node.getTextContent(), slot: node.getHighlightType() ?? null };
  }
  if ($isLineBreakNode(node)) return { kind: "break" };
  if ($isTabNode(node)) return { kind: "tab" };
  return undefined;
};

/** Whether two code pieces are identical, so an unchanged line is not rewritten. */
const samePart = (a: CodePart | undefined, b: CodePart | undefined): boolean =>
  a !== undefined &&
  b !== undefined &&
  a.kind === b.kind &&
  (a.kind !== "text" || (b.kind === "text" && a.text === b.text));

const $nodeOf = (part: CodePart): LexicalNode =>
  part.kind === "break"
    ? $createLineBreakNode()
    : part.kind === "tab"
      ? $createTabNode()
      : $createCodeHighlightNode(part.text, part.slot);

/** Offset of a point within the code block's text, or `undefined` if it is not in it. */
function offsetIn(code: CodeNode, point: PointType): number | undefined {
  if (point.type !== "text") return undefined;
  let offset = 0;
  for (const child of code.getChildren()) {
    if (child.is(point.getNode())) return offset + point.offset;
    offset += child.getTextContentSize();
  }
  return undefined;
}

function $placePoint(code: CodeNode, point: PointType, target: number): void {
  let remaining = target;
  for (const child of code.getChildren()) {
    const size = child.getTextContentSize();
    if ($isTextNode(child) && !$isTabNode(child) && remaining <= size) {
      point.set(child.getKey(), remaining, "text");
      return;
    }
    remaining -= size;
  }
}

/**
 * Brings a code block's children in line with its text: coloured runs, real
 * line breaks. Children that already match are only retyped, so a keystroke
 * repaints without moving the caret; a changed shape rebuilds the children and
 * puts the selection back at the same character. The text, and so the markdown
 * the block exports, never changes.
 */
export function $highlightCodeBlock(code: CodeNode): void {
  const desired = codeParts(code.getTextContent(), code.getLanguage() ?? undefined);
  const current = code.getChildren();

  if (
    current.length === desired.length &&
    current.every((node, index) => samePart(partOf(node), desired[index]))
  ) {
    current.forEach((node, index) => {
      const part = desired[index];
      if ($isCodeHighlightNode(node) && part?.kind === "text") {
        if ((node.getHighlightType() ?? null) !== part.slot) node.setHighlightType(part.slot);
      }
    });
    return;
  }

  const selection = $getSelection();
  const range = $isRangeSelection(selection) ? selection : null;
  const anchor = range ? offsetIn(code, range.anchor) : undefined;
  const focus = range ? offsetIn(code, range.focus) : undefined;

  code.clear();
  code.append(...desired.map($nodeOf));

  if (range && anchor !== undefined) $placePoint(code, range.anchor, anchor);
  if (range && focus !== undefined) $placePoint(code, range.focus, focus);
}

/** Keeps every code block in the editor highlighted. Returns the unregister function. */
export const registerCodeHighlight = (editor: LexicalEditor): (() => void) =>
  editor.registerNodeTransform(CodeNode, $highlightCodeBlock);
