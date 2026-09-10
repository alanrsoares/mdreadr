import { describe, expect, test } from "bun:test";
import type { BlockAnchor } from "../schemas/index.ts";
import { listDocumentBlocks } from "./anchors.ts";
import {
  applySubBlockEdit,
  collectSubBlocks,
  findSubBlockRange,
  mapTailTarget,
  resolveSubBlockRawMarkdown,
  type SubBlockSplit,
  type SubBlockTarget,
  sameSubBlockTarget,
  splitAroundSubBlock,
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

/** The split with the tail's coordinate map dropped, for the tests that are
 *  about where the cut lands rather than what the tail means. */
const slices = (split: SubBlockSplit | undefined) =>
  split && { ...split, ...(split.after ? { after: split.after.source } : {}) };

describe("splitAroundSubBlock: lists", () => {
  const source = ["- alpha", "- beta", "- gamma"].join("\n");

  test("keeps the items on either side of the edited one", () => {
    expect(slices(splitAroundSubBlock(source, { kind: "list-item", path: [1] }))).toEqual({
      before: "- alpha",
      source: "- beta",
      after: "- gamma",
    });
  });

  test("the first and last items have nothing on one side", () => {
    expect(slices(splitAroundSubBlock(source, { kind: "list-item", path: [0] }))).toEqual({
      source: "- alpha",
      after: "- beta\n- gamma",
    });
    expect(slices(splitAroundSubBlock(source, { kind: "list-item", path: [2] }))).toEqual({
      before: "- alpha\n- beta",
      source: "- gamma",
    });
  });

  test("an ordered list's tail carries on counting, because the markers are the author's", () => {
    const ordered = ["1. one", "2. two", "3. three"].join("\n");
    expect(slices(splitAroundSubBlock(ordered, { kind: "list-item", path: [1] }))).toEqual({
      before: "1. one",
      source: "2. two",
      after: "3. three",
    });
  });

  test("a parent item takes its whole subtree with it", () => {
    const nested = ["- alpha", "  - alpha one", "- beta"].join("\n");
    expect(slices(splitAroundSubBlock(nested, { kind: "list-item", path: [0] }))).toEqual({
      source: "- alpha\n  - alpha one",
      after: "- beta",
    });
  });

  test("a nested item is cut out on its own, and what is left is still a list", () => {
    const nested = ["- alpha", "  - alpha one", "  - alpha two", "- beta"].join("\n");
    expect(slices(splitAroundSubBlock(nested, { kind: "list-item", path: [0, 0] }))).toEqual({
      before: "- alpha",
      source: "  - alpha one",
      // The parent reopens empty so the sibling left behind still nests.
      after: "-\n  - alpha two\n- beta",
    });
  });

  test("a deeper item reopens every ancestor above its tail", () => {
    const nested = ["- alpha", "  - alpha one", "    - deep a", "    - deep b"].join("\n");
    expect(slices(splitAroundSubBlock(nested, { kind: "list-item", path: [0, 0, 0] }))).toEqual({
      before: "- alpha\n  - alpha one",
      source: "    - deep a",
      after: "-\n  -\n    - deep b",
    });
  });

  test("a path with no item behind it splits into nothing", () => {
    const nested = ["- alpha", "  - alpha one"].join("\n");
    expect(splitAroundSubBlock(nested, { kind: "list-item", path: [0, 4] })).toBeUndefined();
  });

  test("an item that is no longer there splits into nothing", () => {
    expect(splitAroundSubBlock(source, { kind: "list-item", path: [9] })).toBeUndefined();
  });
});

describe("splitAroundSubBlock: tables", () => {
  const source = [
    "| Name | Size |",
    "| :--- | ---: |",
    "| alpha | 1 |",
    "| beta | 2 |",
    "| gamma | 3 |",
  ].join("\n");

  test("both halves carry the header and the alignment row, so both still render as tables", () => {
    expect(slices(splitAroundSubBlock(source, { kind: "table-row", row: 2 }))).toEqual({
      before: "| Name | Size |\n| :--- | ---: |\n| alpha | 1 |",
      source: "| beta | 2 |",
      after: "| Name | Size |\n| :--- | ---: |\n| gamma | 3 |",
    });
  });

  test("the last row leaves no tail to render", () => {
    expect(slices(splitAroundSubBlock(source, { kind: "table-row", row: 3 }))).toEqual({
      before: "| Name | Size |\n| :--- | ---: |\n| alpha | 1 |\n| beta | 2 |",
      source: "| gamma | 3 |",
    });
  });

  test("editing the header keeps the body under a blank header of its own", () => {
    expect(slices(splitAroundSubBlock(source, { kind: "table-row", row: 0 }))).toEqual({
      source: "| Name | Size |",
      after: [
        "|   |   |",
        "| :--- | ---: |",
        "| alpha | 1 |",
        "| beta | 2 |",
        "| gamma | 3 |",
      ].join("\n"),
    });
  });

  test("a row that is no longer there splits into nothing", () => {
    expect(splitAroundSubBlock(source, { kind: "table-row", row: 9 })).toBeUndefined();
  });
});

describe("mapTailTarget", () => {
  /** The tail of splitting `source` at `target`, or a failure loud enough to
   *  read: a test that maps against no tail is testing nothing. */
  const tailOf = (source: string, target: SubBlockTarget) => {
    const after = splitAroundSubBlock(source, target)?.after;
    if (!after) throw new Error(`no tail splitting at ${JSON.stringify(target)}`);
    return after;
  };

  test("a tail item's own path names the item further down the list", () => {
    const source = ["- alpha", "- beta", "- gamma"].join("\n");
    const tail = tailOf(source, { kind: "list-item", path: [0] });
    expect(mapTailTarget(tail, { kind: "list-item", path: [0] })).toEqual({
      kind: "list-item",
      path: [1],
    });
    expect(mapTailTarget(tail, { kind: "list-item", path: [1] })).toEqual({
      kind: "list-item",
      path: [2],
    });
  });

  test("a nested tail item is named past the reopened ancestors", () => {
    const source = ["- alpha", "  - one", "  - two", "- beta"].join("\n");
    const tail = tailOf(source, { kind: "list-item", path: [0, 0] });
    expect(mapTailTarget(tail, { kind: "list-item", path: [0, 0] })).toEqual({
      kind: "list-item",
      path: [0, 1],
    });
    expect(mapTailTarget(tail, { kind: "list-item", path: [1] })).toEqual({
      kind: "list-item",
      path: [1],
    });
  });

  test("a reopened ancestor stands for no item, so the block is the answer", () => {
    const source = ["- alpha", "  - one", "  - two", "- beta"].join("\n");
    const tail = tailOf(source, { kind: "list-item", path: [0, 0] });
    // Path [0] in the tail is the empty marker reopening `alpha`.
    expect(mapTailTarget(tail, { kind: "list-item", path: [0] })).toBeUndefined();
  });

  test("a tail body row is named further down the table, the repeated head aside", () => {
    const source = [
      "| Name | Size |",
      "| :--- | ---: |",
      "| alpha | 1 |",
      "| beta | 2 |",
      "| gamma | 3 |",
    ].join("\n");
    const tail = tailOf(source, { kind: "table-row", row: 1 });
    expect(mapTailTarget(tail, { kind: "table-row", row: 1 })).toEqual({
      kind: "table-row",
      row: 2,
    });
    expect(mapTailTarget(tail, { kind: "table-row", row: 0 })).toEqual({
      kind: "table-row",
      row: 0,
    });
  });

  test("a part the tail does not have is not named at all", () => {
    const source = ["- alpha", "- beta"].join("\n");
    expect(
      mapTailTarget(tailOf(source, { kind: "list-item", path: [0] }), {
        kind: "list-item",
        path: [7],
      }),
    ).toBeUndefined();
  });
});

describe("splitAroundSubBlock: cut then map is the identity", () => {
  const lists = [
    ["- alpha", "- beta", "- gamma"],
    ["1. one", "2. two", "3. three", "4. four"],
    ["- alpha", "  - one", "  - two", "- beta", "  - three", "    - deep", "- gamma"],
    ["* a", "* b", "  * b one", "  * b two", "    * b two deep", "* c"],
    ["- alpha", "", "- beta", "", "  continued", "- gamma"],
    ["- alpha", "  ```", "  - not an item", "  ```", "- beta"],
  ].map((lines) => lines.join("\n"));

  const tables = [
    ["| Name | Size |", "| :--- | ---: |", "| alpha | 1 |", "| beta | 2 |", "| gamma | 3 |"],
    ["| a | b |", "| --- | --- |", "| 1 | 2 |"],
  ].map((lines) => lines.join("\n"));

  /** The source of one sub-block, read straight out of the text it belongs to. */
  const sliceOf = (source: string, kind: SubBlockTarget["kind"], target: SubBlockTarget) => {
    const span = collectSubBlocks(source, kind).find((entry) =>
      sameSubBlockTarget(entry.target, target),
    );
    return span && source.slice(span.range.start, span.range.end);
  };

  /**
   * Every sub-block the tail offers has to be a sub-block of the block, and the
   * same one: the text under the reader's pointer in the tail is the text the
   * mapped target would put in the editor. Held for every sub-block of every
   * source below, so the two coordinate spaces cannot drift apart silently.
   */
  const holdsFor = (kind: SubBlockTarget["kind"], source: string): number => {
    let checked = 0;
    for (const { target } of collectSubBlocks(source, kind)) {
      const after = splitAroundSubBlock(source, target)?.after;
      if (!after) continue;

      for (const { local, parent } of after.targets) {
        // The one pairing that is not a slice of the block: editing a table's
        // header leaves a blanked copy of it above the body.
        if (sameSubBlockTarget(parent, target)) continue;
        expect(sliceOf(after.source, kind, local)).toBe(sliceOf(source, kind, parent));
        checked += 1;
      }

      // Nothing in the tail is left unnamed except the reopened ancestors,
      // which have no source of their own.
      const named = collectSubBlocks(after.source, kind).filter((entry) =>
        after.targets.some((pair) => sameSubBlockTarget(pair.local, entry.target)),
      );
      expect(named.length).toBe(after.targets.length);
    }
    return checked;
  };

  /** How many pairings the sources below are expected to produce, so a split
   *  that quietly stopped returning tails fails here instead of passing. */
  const total = (kind: SubBlockTarget["kind"], sources: string[]): number =>
    sources.reduce((sum, source) => sum + holdsFor(kind, source), 0);

  test("for every item of every list", () => {
    expect(total("list-item", lists)).toBeGreaterThan(30);
  });

  test("for every row of every table", () => {
    expect(total("table-row", tables)).toBeGreaterThan(5);
  });
});
