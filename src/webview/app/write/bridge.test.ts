import { describe, expect, it } from "bun:test";
import { $nodesOfType, TextNode } from "lexical";
import { $exportMarkdown, createHeadlessEditor, normalizeThroughEditor } from "./bridge.ts";
import { spliceMarkdown, splitSourceBlocks } from "./splice.ts";
import { applyWriteEdit, startWriteSync } from "./write-sync.ts";

/**
 * Round-trip fixtures, one per node type. Each is written the way a person
 * writes markdown, not the way the editor would normalize it (star bullets,
 * padded tables, setext-free headings), because the claim under test is that
 * a Document the reader never edits keeps its bytes.
 */
const FIXTURES: Record<string, { source: string; edit: [from: string, to: string] }> = {
  heading: { source: "# Title\n\nbody\n\n## Second\n", edit: ["Second", "Changed"] },
  paragraph: {
    source: "One *emph* and **strong** and `code`.\n\nTwo.\n",
    edit: ["Two.", "Two, edited."],
  },
  "nested list": {
    source: "* one\n* two\n    * deep\n    * deeper\n* three\n\nafter\n",
    edit: ["deeper", "deepest"],
  },
  "task list": {
    source: "* [ ] open\n* [x] done\n\nafter\n",
    edit: ["open", "still open"],
  },
  "ordered list": { source: "1. a\n2. b\n3. c\n\nafter\n", edit: ["b", "bee"] },
  quote: { source: "> quoted\n> across lines\n\nafter\n", edit: ["quoted", "said"] },
  "code fence": {
    source: '```ts title="x"\nconst a = 1;\n\nconst b = 2;\n```\n\nafter\n',
    edit: ["const a = 1;", "const a = 3;"],
  },
  table: {
    source: "| name  | qty |\n|:------|----:|\n| apple | 1   |\n| pear  | 22  |\n\nafter\n",
    edit: ["apple", "plum"],
  },
  link: {
    source: 'See [the docs](https://example.com/a_b "Docs") now.\n\nafter\n',
    edit: ["now", "later"],
  },
  image: {
    source: 'Look: ![pic](img/a b.png)\n\n![hero](img/h.png "cap")\n\nafter\n',
    edit: ["after", "end"],
  },
  "thematic break": { source: "above\n\n***\n\nbelow\n", edit: ["below", "under"] },
  "front matter": { source: "---\ntitle: keep\n---\n\n# Hi\n\ntext\n", edit: ["text", "words"] },
};

/** Edits a text node the way typing would: through the editor, not the string. */
function editText(markdown: string, [from, to]: [string, string]) {
  const editor = createHeadlessEditor();
  const baseline = normalizeThroughEditor(markdown, editor);
  let next = baseline;
  editor.update(
    () => {
      const node = $nodesOfType(TextNode).find((candidate) =>
        candidate.getTextContent().includes(from),
      );
      if (!node) throw new Error(`no text node contains ${from}`);
      node.setTextContent(node.getTextContent().replace(from, to));
      next = $exportMarkdown();
    },
    { discrete: true },
  );
  return { baseline, next };
}

describe("Write round trip", () => {
  for (const [name, { source, edit }] of Object.entries(FIXTURES)) {
    describe(name, () => {
      it("keeps the source's blocks and the editor's in step", () => {
        const baseline = normalizeThroughEditor(source);
        expect(splitSourceBlocks(baseline).length).toBe(splitSourceBlocks(source).length);
      });

      it("is byte-identical when unedited", () => {
        const baseline = normalizeThroughEditor(source);
        expect(spliceMarkdown(source, baseline, baseline)).toBe(source);
        const sync = applyWriteEdit(startWriteSync(source, baseline), baseline);
        expect(sync.changed).toBe(false);
        expect(sync.sync.markdown).toBe(source);
      });

      it("rewrites only the edited block", () => {
        const { baseline, next } = editText(source, edit);
        expect(next).not.toBe(baseline);

        const result = spliceMarkdown(source, baseline, next);
        const before = splitSourceBlocks(source).map((b) => b.text);
        const after = splitSourceBlocks(result).map((b) => b.text);
        expect(after.length).toBe(before.length);

        const changed = after.filter((text, index) => text !== before[index]);
        expect(changed.length).toBe(1);
        expect(result).toContain(edit[1]);
        // Front matter, trailing newline: outside every block, so never touched.
        expect(result.endsWith("\n")).toBe(true);
        if (source.startsWith("---"))
          expect(result.startsWith("---\ntitle: keep\n---\n")).toBe(true);
      });
    });
  }

  it("normalizes each node to markdown the editor can read again", () => {
    for (const { source } of Object.values(FIXTURES)) {
      const once = normalizeThroughEditor(source);
      expect(normalizeThroughEditor(once)).toBe(once);
    }
  });

  it("exports the markdown shapes it imports", () => {
    const exported = normalizeThroughEditor(
      '* [x] done\n\n| a | b |\n|:--|--:|\n| **1** | x \\| y |\n\n***\n\n![p](a.png "t")\n',
    );
    expect(exported).toContain("[x] done");
    expect(exported).toContain("| a | b |\n| --- | --- |\n| **1** | x \\| y |");
    expect(exported).toContain("---");
    expect(exported).toContain('![p](a.png "t")');
  });

  it("keeps untouched blocks verbatim across a sequence of edits", () => {
    const source = "* a\n* b\n\n| x   | y |\n|-----|---|\n| 1   | 2 |\n\nlast\n";
    const editor = createHeadlessEditor();
    const baseline = normalizeThroughEditor(source, editor);
    let sync = startWriteSync(source, baseline);

    for (const [from, to] of [
      ["last", "final"],
      ["final", "finished"],
    ] as const) {
      editor.update(
        () => {
          const node = $nodesOfType(TextNode).find((n) => n.getTextContent().includes(from));
          node?.setTextContent(to);
          sync = applyWriteEdit(sync, $exportMarkdown()).sync;
        },
        { discrete: true },
      );
    }

    expect(sync.markdown).toBe("* a\n* b\n\n| x   | y |\n|-----|---|\n| 1   | 2 |\n\nfinished\n");
  });
});
