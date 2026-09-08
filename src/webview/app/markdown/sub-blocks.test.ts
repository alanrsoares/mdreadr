import { describe, expect, test } from "bun:test";
import { remapSubBlockTargetFromAfter, splitAroundSubBlock, subBlockNoun } from "./sub-blocks.ts";

describe("subBlockNoun", () => {
  test("names the part in reader language", () => {
    expect(subBlockNoun("list-item")).toBe("item");
    expect(subBlockNoun("table-row")).toBe("row");
  });
});

describe("splitAroundSubBlock: lists", () => {
  const source = ["- alpha", "- beta", "- gamma"].join("\n");

  test("keeps the items on either side of the edited one", () => {
    expect(splitAroundSubBlock(source, { kind: "list-item", path: [1] })).toEqual({
      before: "- alpha",
      source: "- beta",
      after: "- gamma",
    });
  });

  test("the first and last items have nothing on one side", () => {
    expect(splitAroundSubBlock(source, { kind: "list-item", path: [0] })).toEqual({
      source: "- alpha",
      after: "- beta\n- gamma",
    });
    expect(splitAroundSubBlock(source, { kind: "list-item", path: [2] })).toEqual({
      before: "- alpha\n- beta",
      source: "- gamma",
    });
  });

  test("an ordered list's tail carries on counting, because the markers are the author's", () => {
    const ordered = ["1. one", "2. two", "3. three"].join("\n");
    expect(splitAroundSubBlock(ordered, { kind: "list-item", path: [1] })).toEqual({
      before: "1. one",
      source: "2. two",
      after: "3. three",
    });
  });

  test("a parent item takes its whole subtree with it", () => {
    const nested = ["- alpha", "  - alpha one", "- beta"].join("\n");
    expect(splitAroundSubBlock(nested, { kind: "list-item", path: [0] })).toEqual({
      source: "- alpha\n  - alpha one",
      after: "- beta",
    });
  });

  test("a nested item is cut out on its own, and what is left is still a list", () => {
    const nested = ["- alpha", "  - alpha one", "  - alpha two", "- beta"].join("\n");
    expect(splitAroundSubBlock(nested, { kind: "list-item", path: [0, 0] })).toEqual({
      before: "- alpha",
      source: "  - alpha one",
      // The parent reopens empty so the sibling left behind still nests.
      after: "-\n  - alpha two\n- beta",
    });
  });

  test("a deeper item reopens every ancestor above its tail", () => {
    const nested = ["- alpha", "  - alpha one", "    - deep a", "    - deep b"].join("\n");
    expect(splitAroundSubBlock(nested, { kind: "list-item", path: [0, 0, 0] })).toEqual({
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
    expect(splitAroundSubBlock(source, { kind: "table-row", row: 2 })).toEqual({
      before: "| Name | Size |\n| :--- | ---: |\n| alpha | 1 |",
      source: "| beta | 2 |",
      after: "| Name | Size |\n| :--- | ---: |\n| gamma | 3 |",
    });
  });

  test("the last row leaves no tail to render", () => {
    expect(splitAroundSubBlock(source, { kind: "table-row", row: 3 })).toEqual({
      before: "| Name | Size |\n| :--- | ---: |\n| alpha | 1 |\n| beta | 2 |",
      source: "| gamma | 3 |",
    });
  });

  test("editing the header keeps the body under a blank header of its own", () => {
    expect(splitAroundSubBlock(source, { kind: "table-row", row: 0 })).toEqual({
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

describe("remapSubBlockTargetFromAfter", () => {
  test("maps a tail list item's local path back to the parent list", () => {
    const source = ["- alpha", "- beta", "- gamma"].join("\n");
    expect(
      remapSubBlockTargetFromAfter(
        source,
        { kind: "list-item", path: [0] },
        {
          kind: "list-item",
          path: [0],
        },
      ),
    ).toEqual({ kind: "list-item", path: [1] });
  });

  test("maps a nested tail item past the reopened ancestors", () => {
    const source = ["- alpha", "  - one", "  - two", "- beta"].join("\n");
    expect(
      remapSubBlockTargetFromAfter(
        source,
        { kind: "list-item", path: [0, 0] },
        {
          kind: "list-item",
          path: [0, 0],
        },
      ),
    ).toEqual({ kind: "list-item", path: [0, 1] });
  });

  test("maps a tail table body row back to the parent table", () => {
    const source = [
      "| Name | Size |",
      "| :--- | ---: |",
      "| alpha | 1 |",
      "| beta | 2 |",
      "| gamma | 3 |",
    ].join("\n");
    expect(
      remapSubBlockTargetFromAfter(
        source,
        { kind: "table-row", row: 1 },
        {
          kind: "table-row",
          row: 1,
        },
      ),
    ).toEqual({ kind: "table-row", row: 2 });
  });
});
