import { describe, expect, test } from "bun:test";
import {
  closesTheEditor,
  type EditorSurface,
  editorIntent,
  type Keystroke,
  nextToolIndex,
  swallowsKeystroke,
  toolsFor,
} from "./inline-edit-keys.ts";

const stroke = (key: string, over: Partial<Keystroke> = {}): Keystroke => ({
  key,
  hasMod: false,
  hasAlt: false,
  hasShift: false,
  isInSource: true,
  ...over,
});

const surface = (over: Partial<EditorSurface> = {}): EditorSurface => ({
  kind: "paragraph",
  isDirty: false,
  isDiscardArmed: false,
  ...over,
});

/** The intent's name alone, for the cases where the payload is not the point. */
const intentOf = (key: Keystroke, state: EditorSurface) => editorIntent(key, state).kind;

describe("editorIntent: Escape", () => {
  test("closes a clean editor at once — there is nothing to lose", () => {
    expect(intentOf(stroke("Escape"), surface())).toBe("cancel");
  });

  test("asks again before discarding text that exists nowhere else", () => {
    expect(intentOf(stroke("Escape"), surface({ isDirty: true }))).toBe("armDiscard");
  });

  test("the second press discards", () => {
    const armed = surface({ isDirty: true, isDiscardArmed: true });
    expect(intentOf(stroke("Escape"), armed)).toBe("cancel");
  });

  test("closes from the toolbar too, not only from the source", () => {
    expect(intentOf(stroke("Escape", { isInSource: false }), surface())).toBe("cancel");
  });

  test("modifiers do not change what Escape means", () => {
    expect(intentOf(stroke("Escape", { hasMod: true }), surface({ isDirty: true }))).toBe(
      "armDiscard",
    );
  });
});

describe("editorIntent: applying", () => {
  test("the platform modifier with Enter applies", () => {
    expect(intentOf(stroke("Enter", { hasMod: true }), surface())).toBe("apply");
  });

  test("a bare Enter is a newline in the source, not an apply", () => {
    expect(intentOf(stroke("Enter"), surface())).toBe("none");
  });

  test("applies from the toolbar, where the shortcut is the only way to", () => {
    expect(intentOf(stroke("Enter", { hasMod: true, isInSource: false }), surface())).toBe("apply");
  });
});

describe("editorIntent: tool shortcuts", () => {
  const toolFor = (key: string, state = surface()) => {
    const intent = editorIntent(stroke(key, { hasMod: true }), state);
    return intent.kind === "tool" ? intent.tool.id : intent.kind;
  };

  test("the letter picks the tool, in either case", () => {
    expect(toolFor("b")).toBe("bold");
    expect(toolFor("B")).toBe("bold");
    expect(toolFor("i")).toBe("italic");
    expect(toolFor("k")).toBe("link");
  });

  test("backtick is inline code: the key shows the markdown it inserts", () => {
    expect(toolFor("`")).toBe("code");
    expect(toolFor("e")).toBe("code");
  });

  test("a letter no tool claims is left to the platform", () => {
    expect(toolFor("s")).toBe("none");
  });

  test("Alt chords belong to the system and are not eaten", () => {
    const intent = editorIntent(stroke("b", { hasMod: true, hasAlt: true }), surface());
    expect(intent.kind).toBe("none");
  });

  test("the tool carries its own transform, so dispatch reads no registry", () => {
    const intent = editorIntent(stroke("b", { hasMod: true }), surface());
    expect(intent.kind === "tool" && intent.tool.apply("word", { start: 0, end: 4 }).text).toBe(
      "**word**",
    );
  });
});

describe("toolsFor: headings only where a heading is legal", () => {
  const ids = (kind: Parameters<typeof toolsFor>[0]) => toolsFor(kind).map((tool) => tool.id);

  test("prose can become a heading", () => {
    expect(ids("paragraph")).toContain("heading-1");
    expect(ids("heading")).toContain("heading-3");
  });

  test("a code block or a table cannot: no reader means that edit", () => {
    expect(ids("code")).not.toContain("heading-1");
    expect(ids("table")).not.toContain("heading-1");
  });

  test("every block gets the formatting tools", () => {
    expect(ids("code")).toContain("bold");
    expect(ids("table")).toContain("link");
  });

  test("a tool the block is not offered has no shortcut either", () => {
    const intent = editorIntent(stroke("1", { hasMod: true }), surface({ kind: "code" }));
    expect(intent.kind).toBe("none");
  });
});

describe("editorIntent: Tab", () => {
  test("indents inside the source", () => {
    expect(intentOf(stroke("Tab"), surface())).toBe("indent");
  });

  test("outdents with Shift", () => {
    expect(intentOf(stroke("Tab", { hasShift: true }), surface())).toBe("outdent");
  });

  test("on the toolbar it stays focus movement, so the editor is no trap", () => {
    expect(intentOf(stroke("Tab", { isInSource: false }), surface())).toBe("none");
    expect(intentOf(stroke("Tab", { isInSource: false, hasShift: true }), surface())).toBe("none");
  });
});

describe("editorIntent: everything else", () => {
  test("ordinary typing is the source editor's own business", () => {
    for (const key of ["a", " ", "ArrowDown", "Backspace", "F5", "Shift"]) {
      expect(intentOf(stroke(key), surface())).toBe("none");
    }
  });
});

describe("swallowsKeystroke", () => {
  test("a keystroke the editor acts on is not also the browser's", () => {
    expect(swallowsKeystroke(editorIntent(stroke("Tab"), surface()))).toBe(true);
    expect(swallowsKeystroke(editorIntent(stroke("Enter", { hasMod: true }), surface()))).toBe(
      true,
    );
  });

  test("one it ignores passes straight through", () => {
    expect(swallowsKeystroke(editorIntent(stroke("a"), surface()))).toBe(false);
  });
});

describe("closesTheEditor", () => {
  test("both halves of the discard stop at the editor", () => {
    expect(closesTheEditor(editorIntent(stroke("Escape"), surface()))).toBe(true);
    expect(closesTheEditor(editorIntent(stroke("Escape"), surface({ isDirty: true })))).toBe(true);
  });

  test("an edit does not: nothing outside is listening for it", () => {
    expect(closesTheEditor(editorIntent(stroke("Tab"), surface()))).toBe(false);
  });
});

describe("nextToolIndex", () => {
  test("the arrows walk the toolbar", () => {
    expect(nextToolIndex("ArrowRight", 0, 8)).toBe(1);
    expect(nextToolIndex("ArrowLeft", 3, 8)).toBe(2);
  });

  test("and wrap, so the walk never dead-ends", () => {
    expect(nextToolIndex("ArrowRight", 7, 8)).toBe(0);
    expect(nextToolIndex("ArrowLeft", 0, 8)).toBe(7);
  });

  test("Home and End jump to the edges", () => {
    expect(nextToolIndex("Home", 4, 8)).toBe(0);
    expect(nextToolIndex("End", 4, 8)).toBe(7);
  });

  test("focus nowhere on a tool starts at the end the arrow points away from", () => {
    expect(nextToolIndex("ArrowRight", -1, 8)).toBe(0);
    expect(nextToolIndex("ArrowLeft", -1, 8)).toBe(7);
  });

  test("a key the toolbar does not own moves nothing", () => {
    expect(nextToolIndex("ArrowDown", 0, 8)).toBeUndefined();
    expect(nextToolIndex("a", 0, 8)).toBeUndefined();
  });

  test("an empty toolbar has nowhere to move", () => {
    expect(nextToolIndex("ArrowRight", -1, 0)).toBeUndefined();
    expect(nextToolIndex("Home", -1, 0)).toBeUndefined();
  });
});
