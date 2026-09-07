import { describe, expect, it } from "bun:test";
import {
  indent,
  insertLink,
  outdent,
  setHeadingLevel,
  toggleLinePrefix,
  wrapSelection,
} from "./inline-edit-ops.ts";

/** Marks the selection in a fixture with `|` (collapsed) or `[...]` (range). */
function parse(fixture: string): { value: string; selection: { start: number; end: number } } {
  const caret = fixture.indexOf("|");
  if (caret !== -1) {
    return { value: fixture.replace("|", ""), selection: { start: caret, end: caret } };
  }
  const start = fixture.indexOf("[");
  const end = fixture.indexOf("]") - 1;
  return { value: fixture.replace("[", "").replace("]", ""), selection: { start, end } };
}

/** Renders an edit back into the `|` / `[...]` notation for readable assertions. */
function render({ text, selection }: ReturnType<typeof wrapSelection>): string {
  if (selection.start === selection.end) {
    return `${text.slice(0, selection.start)}|${text.slice(selection.start)}`;
  }
  return `${text.slice(0, selection.start)}[${text.slice(selection.start, selection.end)}]${text.slice(selection.end)}`;
}

const bold = (fixture: string) => {
  const { value, selection } = parse(fixture);
  return render(wrapSelection(value, selection, "**", "**", "bold text"));
};

describe("wrapSelection", () => {
  it("wraps a selection and keeps it selected", () => {
    expect(bold("keep [this] one")).toBe("keep **[this]** one");
  });

  it("unwraps a selection that already carries the markers", () => {
    expect(bold("keep **[this]** one")).toBe("keep [this] one");
  });

  it("wraps the word under a collapsed caret", () => {
    expect(bold("keep th|is one")).toBe("keep **[this]** one");
  });

  it("inserts a pre-selected placeholder with no word to take", () => {
    expect(bold("end of line |")).toBe("end of line **[bold text]**");
  });

  it("round-trips through the word path", () => {
    expect(bold(bold("keep th|is one"))).toBe("keep [this] one");
  });
});

describe("toggleLinePrefix", () => {
  it("prefixes the caret line", () => {
    const { value, selection } = parse("al|pha");
    expect(toggleLinePrefix(value, selection, "- ").text).toBe("- alpha");
  });

  it("prefixes every line the selection touches", () => {
    const { value, selection } = parse("[alpha\nbeta\ngamma]");
    expect(toggleLinePrefix(value, selection, "- ").text).toBe("- alpha\n- beta\n- gamma");
  });

  it("strips the prefix when every touched line has it", () => {
    const { value, selection } = parse("[- alpha\n- beta]");
    expect(toggleLinePrefix(value, selection, "- ").text).toBe("alpha\nbeta");
  });

  it("prefixes a mixed selection rather than stripping it", () => {
    const { value, selection } = parse("[- alpha\nbeta]");
    expect(toggleLinePrefix(value, selection, "- ").text).toBe("- - alpha\n- beta");
  });

  it("keeps the caret on its own line when the prefix is removed", () => {
    const { value, selection } = parse("- al|pha");
    expect(render(toggleLinePrefix(value, selection, "- "))).toBe("al|pha");
  });
});

describe("setHeadingLevel", () => {
  it("promotes a paragraph", () => {
    const { value, selection } = parse("Overview|");
    expect(setHeadingLevel(value, selection, 2).text).toBe("## Overview");
  });

  it("replaces an existing level", () => {
    const { value, selection } = parse("### Over|view");
    expect(setHeadingLevel(value, selection, 1).text).toBe("# Overview");
  });

  it("toggles the same level back off", () => {
    const { value, selection } = parse("## Over|view");
    expect(setHeadingLevel(value, selection, 2).text).toBe("Overview");
  });

  it("only touches the caret line", () => {
    const { value, selection } = parse("## Alpha\nbe|ta");
    expect(setHeadingLevel(value, selection, 3).text).toBe("## Alpha\n### beta");
  });
});

describe("insertLink", () => {
  it("makes the selection the label and selects the url", () => {
    const { value, selection } = parse("see [the docs] now");
    expect(render(insertLink(value, selection))).toBe("see [the docs]([url]) now");
  });

  it("makes a url-like selection the target and selects the label", () => {
    const { value, selection } = parse("[https://example.com]");
    expect(render(insertLink(value, selection))).toBe("[[text]](https://example.com)");
  });

  it("inserts a full link at an empty caret", () => {
    const { value, selection } = parse("read this: |");
    expect(render(insertLink(value, selection))).toBe("read this: [link]([url])");
  });
});

describe("indent / outdent", () => {
  it("inserts two spaces at a caret", () => {
    const { value, selection } = parse("- item|");
    expect(render(indent(value, selection))).toBe("- item  |");
  });

  it("indents every line of a multi-line selection", () => {
    const { value, selection } = parse("[- a\n- b]");
    expect(indent(value, selection).text).toBe("  - a\n  - b");
  });

  it("outdents by one level and tolerates unindented lines", () => {
    const { value, selection } = parse("[  - a\n- b]");
    expect(outdent(value, selection).text).toBe("- a\n- b");
  });
});
