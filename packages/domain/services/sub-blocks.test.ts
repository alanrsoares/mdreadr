import { describe, expect, test } from "bun:test";
import type { BlockAnchor } from "../schemas/index.ts";
import { listDocumentBlocks } from "./anchors.ts";
import {
  applySubBlockEdit,
  collectSubBlocks,
  findSubBlockRange,
  resolveSubBlockRawMarkdown,
  subBlockKindForAnchor,
} from "./sub-blocks.ts";

/** The anchor the reader would pin on the document's only list or table. */
const anchorFor = (content: string, kind: "list" | "table"): BlockAnchor => {
  const block = listDocumentBlocks(content).find((entry) => entry.kind === kind);
  if (!block) throw new Error(`no ${kind} block in fixture`);
  return { kind, blockId: block.blockId };
};

describe("subBlockKindForAnchor", () => {
  test("only lists and tables have sub-blocks", () => {
    expect(subBlockKindForAnchor({ kind: "list", blockId: "l" })).toBe("list-item");
    expect(subBlockKindForAnchor({ kind: "table", blockId: "t" })).toBe("table-row");
    expect(subBlockKindForAnchor({ kind: "paragraph", blockId: "p" })).toBeUndefined();
    expect(subBlockKindForAnchor({ kind: "heading", blockId: "h" })).toBeUndefined();
    expect(subBlockKindForAnchor({ kind: "code", blockId: "c" })).toBeUndefined();
    expect(subBlockKindForAnchor({ kind: "document", blockId: "d" })).toBeUndefined();
  });
});

describe("collectSubBlocks: list items", () => {
  const sliced = (source: string): string[] =>
    collectSubBlocks(source, "list-item").map((span) =>
      source.slice(span.range.start, span.range.end),
    );

  test("splits a tight bullet list one item at a time", () => {
    expect(sliced(["- alpha", "- beta", "- gamma"].join("\n"))).toEqual([
      "- alpha",
      "- beta",
      "- gamma",
    ]);
  });

  test("keeps ordered markers exactly as written", () => {
    expect(sliced(["3. third", "4) fourth"].join("\n"))).toEqual(["3. third", "4) fourth"]);
  });

  test("a parent's range covers its nested children, and each child is its own span", () => {
    const source = ["- alpha", "  - alpha one", "  - alpha two", "- beta"].join("\n");
    expect(sliced(source)).toEqual([
      "- alpha\n  - alpha one\n  - alpha two",
      "  - alpha one",
      "  - alpha two",
      "- beta",
    ]);
    expect(collectSubBlocks(source, "list-item").map((span) => span.target)).toEqual([
      { kind: "list-item", path: [0] },
      { kind: "list-item", path: [0, 0] },
      { kind: "list-item", path: [0, 1] },
      { kind: "list-item", path: [1] },
    ]);
  });

  test("nesting goes as deep as the author took it", () => {
    const source = ["- alpha", "  - one", "    - one deep", "- beta"].join("\n");
    expect(collectSubBlocks(source, "list-item").map((span) => span.target)).toEqual([
      { kind: "list-item", path: [0] },
      { kind: "list-item", path: [0, 0] },
      { kind: "list-item", path: [0, 0, 0] },
      { kind: "list-item", path: [1] },
    ]);
    expect(sliced(source)[2]).toBe("    - one deep");
  });

  test("a loose list's blank lines stay between items, not inside them", () => {
    const source = ["- alpha", "", "- beta"].join("\n");
    expect(sliced(source)).toEqual(["- alpha", "- beta"]);
  });

  test("an item's continuation paragraph and code stay with it", () => {
    const source = [
      "- alpha",
      "",
      "  more about alpha",
      "",
      "  ```ts",
      "  const x = 1;",
      "  ```",
      "- beta",
    ].join("\n");
    expect(sliced(source)).toEqual([
      "- alpha\n\n  more about alpha\n\n  ```ts\n  const x = 1;\n  ```",
      "- beta",
    ]);
  });

  test("labels preview the item", () => {
    const spans = collectSubBlocks("- alpha\n- beta", "list-item");
    expect(spans.map((span) => span.label)).toEqual(["- alpha", "- beta"]);
    expect(spans.map((span) => span.target)).toEqual([
      { kind: "list-item", path: [0] },
      { kind: "list-item", path: [1] },
    ]);
  });

  test("source with no marker at all has no items", () => {
    expect(collectSubBlocks("just a paragraph", "list-item")).toEqual([]);
  });

  test("a list marker inside a fenced code block is code, not an item", () => {
    const source = [
      "- alpha",
      "  ```sh",
      "  - not an item",
      "  ```",
      "  - alpha one",
      "- beta",
    ].join("\n");
    expect(sliced(source)).toEqual([
      ["- alpha", "  ```sh", "  - not an item", "  ```", "  - alpha one"].join("\n"),
      "  - alpha one",
      "- beta",
    ]);
    expect(collectSubBlocks(source, "list-item").map((span) => span.target)).toEqual([
      { kind: "list-item", path: [0] },
      { kind: "list-item", path: [0, 0] },
      { kind: "list-item", path: [1] },
    ]);
  });
});

describe("collectSubBlocks: table rows", () => {
  const source = ["| Name | Size |", "| :--- | ---: |", "| alpha | 1 |", "| beta | 2 |"].join("\n");

  test("header is row 0 and the delimiter is not a row", () => {
    const spans = collectSubBlocks(source, "table-row");
    expect(spans.map((span) => source.slice(span.range.start, span.range.end))).toEqual([
      "| Name | Size |",
      "| alpha | 1 |",
      "| beta | 2 |",
    ]);
    expect(spans.map((span) => span.target)).toEqual([
      { kind: "table-row", row: 0 },
      { kind: "table-row", row: 1 },
      { kind: "table-row", row: 2 },
    ]);
  });

  test("without a delimiter row there is no table to split", () => {
    expect(collectSubBlocks("| Name | Size |\n| alpha | 1 |", "table-row")).toEqual([]);
  });

  test("a dash-only body row is a row, not a second delimiter", () => {
    // GFM renders it as a body cell; dropping it would shift every row under it.
    const dashed = ["| Name | Size |", "| :--- | ---: |", "| --- | --- |", "| beta | 2 |"].join(
      "\n",
    );
    const spans = collectSubBlocks(dashed, "table-row");
    expect(spans.map((span) => dashed.slice(span.range.start, span.range.end))).toEqual([
      "| Name | Size |",
      "| --- | --- |",
      "| beta | 2 |",
    ]);
  });
});

describe("findSubBlockRange, resolveSubBlockRawMarkdown, applySubBlockEdit", () => {
  const content = [
    "# Title",
    "",
    "Intro paragraph.",
    "",
    "- alpha",
    "  - alpha one",
    "- beta",
    "- gamma",
    "",
    "| Name | Size |",
    "| :--- | ---: |",
    "| alpha | 1 |",
    "| beta | 2 |",
    "",
    "Outro paragraph.",
    "",
  ].join("\n");

  test("resolves one list item against the whole document", () => {
    const anchor = anchorFor(content, "list");
    const target = { kind: "list-item" as const, path: [1] };
    const range = findSubBlockRange(content, anchor, target);
    expect(range).toBeDefined();
    expect(content.slice(range?.start, range?.end)).toBe("- beta");
    expect(resolveSubBlockRawMarkdown(content, anchor, target)).toBe("- beta");
  });

  test("editing an item leaves every other byte of the document alone", () => {
    const anchor = anchorFor(content, "list");
    const updated = applySubBlockEdit(
      content,
      anchor,
      { kind: "list-item", path: [1] },
      "- beta **edited**",
    );
    expect(updated).toBe(content.replace("- beta", "- beta **edited**"));
  });

  test("a nested item resolves and splices on its own", () => {
    const anchor = anchorFor(content, "list");
    const target = { kind: "list-item" as const, path: [0, 0] };
    expect(resolveSubBlockRawMarkdown(content, anchor, target)).toBe("  - alpha one");
    expect(applySubBlockEdit(content, anchor, target, "  - alpha one **edited**")).toBe(
      content.replace("  - alpha one", "  - alpha one **edited**"),
    );
  });

  test("a nested path that does not exist resolves to nothing", () => {
    const anchor = anchorFor(content, "list");
    expect(findSubBlockRange(content, anchor, { kind: "list-item", path: [1, 0] })).toBeUndefined();
    expect(findSubBlockRange(content, anchor, { kind: "list-item", path: [] })).toBeUndefined();
  });

  test("editing the first item keeps its nested children", () => {
    const anchor = anchorFor(content, "list");
    const target = { kind: "list-item" as const, path: [0] };
    expect(resolveSubBlockRawMarkdown(content, anchor, target)).toBe("- alpha\n  - alpha one");
    expect(
      applySubBlockEdit(content, anchor, target, "- alpha\n  - alpha one\n  - alpha two"),
    ).toBe(content.replace("- alpha\n  - alpha one", "- alpha\n  - alpha one\n  - alpha two"));
  });

  test("editing a table row touches neither the header nor the delimiter", () => {
    const anchor = anchorFor(content, "table");
    const target = { kind: "table-row" as const, row: 2 };
    expect(resolveSubBlockRawMarkdown(content, anchor, target)).toBe("| beta | 2 |");
    const updated = applySubBlockEdit(content, anchor, target, "| beta | 20 |");
    expect(updated).toBe(content.replace("| beta | 2 |", "| beta | 20 |"));
    expect(updated).toContain("| :--- | ---: |");
  });

  test("the table header is editable as row 0", () => {
    const anchor = anchorFor(content, "table");
    expect(resolveSubBlockRawMarkdown(content, anchor, { kind: "table-row", row: 0 })).toBe(
      "| Name | Size |",
    );
  });

  test("editing a dash-only body row edits that row, not the one after it", () => {
    const dashed = ["| Name | Size |", "| :--- | ---: |", "| --- | --- |", "| beta | 2 |", ""].join(
      "\n",
    );
    const anchor = anchorFor(dashed, "table");
    const target = { kind: "table-row" as const, row: 1 };
    expect(resolveSubBlockRawMarkdown(dashed, anchor, target)).toBe("| --- | --- |");
    expect(applySubBlockEdit(dashed, anchor, target, "| alpha | 1 |")).toBe(
      dashed.replace("| --- | --- |", "| alpha | 1 |"),
    );
  });

  test("an index past the end resolves to nothing rather than the wrong item", () => {
    const anchor = anchorFor(content, "list");
    expect(findSubBlockRange(content, anchor, { kind: "list-item", path: [9] })).toBeUndefined();
    expect(
      applySubBlockEdit(content, anchor, { kind: "list-item", path: [9] }, "- nope"),
    ).toBeUndefined();
  });

  test("an anchor that no longer matches resolves to nothing", () => {
    expect(
      findSubBlockRange(
        content,
        { kind: "list", blockId: "list-deadbeef-0" },
        {
          kind: "list-item",
          path: [0],
        },
      ),
    ).toBeUndefined();
  });
});
