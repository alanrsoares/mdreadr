import { describe, expect, it } from "bun:test";
import { $createCodeHighlightNode, $isCodeHighlightNode, $isCodeNode } from "@lexical/code";
import { $getRoot, $isLineBreakNode } from "lexical";
import { $exportMarkdown, createHeadlessEditor, normalizeThroughEditor } from "./bridge.ts";
import { highlightSegments } from "./code-highlight.ts";
import { codeParts, registerCodeHighlight } from "./code-highlight-register.ts";

const SOURCE = '```ts\nconst a = "x"; // note\n\tlet b = 1;\n```\n\nafter\n';

describe("highlightSegments", () => {
  it("covers the code exactly, coloured by the reader's slots", () => {
    const code = 'const a = "x"; // note';
    const segments = highlightSegments(code, "ts");
    expect(segments.map((segment) => segment.text).join("")).toBe(code);
    expect(segments.find((segment) => segment.text === "const")?.slot).toBe("keyword");
    expect(segments.find((segment) => segment.text === '"x"')?.slot).toBe("string");
    expect(segments.find((segment) => segment.text === "// note")?.slot).toBe("comment");
  });

  it("leaves unknown or missing languages plain", () => {
    expect(highlightSegments("a b", undefined)).toEqual([{ text: "a b", slot: null }]);
    expect(highlightSegments("a b", "nope")).toEqual([{ text: "a b", slot: null }]);
    expect(highlightSegments("", "ts")).toEqual([]);
  });
});

describe("codeParts", () => {
  it("splits line breaks and tabs out of the coloured runs", () => {
    const parts = codeParts("a\n\tb", "ts");
    expect(parts.map((part) => part.kind)).toEqual(["text", "break", "tab", "text"]);
  });
});

describe("code highlighting in the editor", () => {
  const load = () => {
    const editor = createHeadlessEditor();
    registerCodeHighlight(editor);
    return editor;
  };

  it("paints the block and still exports the same markdown", () => {
    const editor = load();
    const exported = normalizeThroughEditor(SOURCE, editor);
    expect(exported).toBe(normalizeThroughEditor(SOURCE));

    editor.read(() => {
      const code = $getRoot().getChildren().find($isCodeNode);
      const children = code?.getChildren() ?? [];
      const types = children.flatMap((child) =>
        $isCodeHighlightNode(child) && child.getHighlightType() ? [child.getHighlightType()] : [],
      );
      expect(types).toContain("keyword");
      expect(types).toContain("string");
      expect(children.some($isLineBreakNode)).toBe(true);
    });
  });

  it("repaints after an edit without changing the text", () => {
    const editor = load();
    normalizeThroughEditor("```ts\nx\n```\n", editor);
    editor.update(
      () => {
        const code = $getRoot().getChildren().find($isCodeNode);
        code?.clear();
        code?.append($createCodeHighlightNode("const x"));
      },
      { discrete: true },
    );
    editor.read(() => {
      const code = $getRoot().getChildren().find($isCodeNode);
      const first = code?.getFirstChild();
      expect($isCodeHighlightNode(first) && first.getHighlightType()).toBe("keyword");
      expect($exportMarkdown()).toBe("```ts\nconst x\n```");
    });
  });
});
