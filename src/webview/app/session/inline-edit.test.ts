import { describe, expect, test } from "bun:test";
import type { SubBlockTarget } from "@mdreadr/domain";
import { isErr, isOk } from "@onrails/result";
import {
  blockEditErrorMessage,
  type InlineEdit,
  type InlineEditStatus,
  isBlockOpen,
  isSameInlineEdit,
  noInlineEdit,
  openInlineEdit,
  openTargetIn,
} from "./inline-edit.ts";

const wholeBlock = (blockId: string, returnIndex = 0): InlineEdit => ({
  blockId,
  target: null,
  returnIndex,
});

const item = (blockId: string, path: number[], returnIndex = 0): InlineEdit => ({
  blockId,
  target: { kind: "list-item", path },
  returnIndex,
});

const row = (blockId: string, index: number, returnIndex = 0): InlineEdit => ({
  blockId,
  target: { kind: "table-row", row: index },
  returnIndex,
});

const holding = (open: InlineEdit, isDirty: boolean): InlineEditStatus => ({ open, isDirty });

describe("openInlineEdit: nothing open", () => {
  test("opens whatever is asked for", () => {
    const opened = openInlineEdit(noInlineEdit, wholeBlock("b1", 4));
    expect(isOk(opened)).toBe(true);
    expect(isOk(opened) && opened.value).toEqual(wholeBlock("b1", 4));
  });
});

describe("openInlineEdit: a clean editor is open", () => {
  test("gives way, because there is no text to lose", () => {
    const opened = openInlineEdit(holding(wholeBlock("b1"), false), wholeBlock("b2"));
    expect(isOk(opened) && opened.value.blockId).toBe("b2");
  });
});

describe("openInlineEdit: a dirty editor is open", () => {
  test("refuses another block, rather than discarding the only copy of the text", () => {
    const refused = openInlineEdit(holding(wholeBlock("b1"), true), wholeBlock("b2"));
    expect(isErr(refused) && refused.error).toEqual({ _tag: "DirtyEditorOpen" });
  });

  test("refuses a different part of the same block: opening it replaces the same editor", () => {
    const refused = openInlineEdit(holding(item("b1", [0]), true), item("b1", [1]));
    expect(isErr(refused)).toBe(true);
  });

  test("refuses the whole block while one of its parts is open", () => {
    const refused = openInlineEdit(holding(item("b1", [0]), true), wholeBlock("b1"));
    expect(isErr(refused)).toBe(true);
  });

  test("re-opening the very same part is the editor already open, so it is allowed", () => {
    const again = openInlineEdit(holding(item("b1", [1, 0]), true), item("b1", [1, 0]));
    expect(isOk(again)).toBe(true);
  });

  test("re-opening keeps the index captured at open: the block is off screen by now", () => {
    const again = openInlineEdit(holding(wholeBlock("b1", 12), true), wholeBlock("b1", -1));
    expect(isOk(again) && again.value.returnIndex).toBe(12);
  });
});

describe("isSameInlineEdit", () => {
  test("nothing open is never the same as something requested", () => {
    expect(isSameInlineEdit(null, wholeBlock("b1"))).toBe(false);
  });

  test("paths are compared by value, step for step", () => {
    expect(isSameInlineEdit(item("b1", [1, 2]), item("b1", [1, 2]))).toBe(true);
    expect(isSameInlineEdit(item("b1", [1, 2]), item("b1", [1]))).toBe(false);
  });

  test("rows are compared by index", () => {
    expect(isSameInlineEdit(row("b1", 3), row("b1", 3))).toBe(true);
    expect(isSameInlineEdit(row("b1", 3), row("b1", 0))).toBe(false);
  });

  test("a part and its whole block are different editors", () => {
    expect(isSameInlineEdit(item("b1", [0]), wholeBlock("b1"))).toBe(false);
  });

  test("the same part of a different block is a different editor", () => {
    expect(isSameInlineEdit(item("b1", [0]), item("b2", [0]))).toBe(false);
  });
});

describe("isBlockOpen", () => {
  test("a block holding the open editor is open, whole or in part", () => {
    expect(isBlockOpen(wholeBlock("b1"), "b1")).toBe(true);
    expect(isBlockOpen(item("b1", [2, 0]), "b1")).toBe(true);
  });

  test("its neighbours are not", () => {
    expect(isBlockOpen(wholeBlock("b1"), "b2")).toBe(false);
  });

  test("nothing open leaves every block closed", () => {
    expect(isBlockOpen(null, "b1")).toBe(false);
  });
});

describe("openTargetIn", () => {
  test("names the part open in that block", () => {
    const target: SubBlockTarget = { kind: "table-row", row: 2 };
    expect(openTargetIn(row("b1", 2), "b1")).toEqual(target);
  });

  test("a whole-block editor has no part open", () => {
    expect(openTargetIn(wholeBlock("b1"), "b1")).toBeUndefined();
  });

  test("another block has nothing open", () => {
    expect(openTargetIn(row("b1", 2), "b2")).toBeUndefined();
  });

  test("nothing open has nothing open in any block", () => {
    expect(openTargetIn(null, "b1")).toBeUndefined();
  });
});

describe("blockEditErrorMessage", () => {
  test("every reason ends with what the reader can do about it", () => {
    expect(blockEditErrorMessage({ _tag: "NoDocument" })).toContain("Save it first");
    expect(blockEditErrorMessage({ _tag: "BlockNotFound" })).toContain("Copy your text");
  });
});
