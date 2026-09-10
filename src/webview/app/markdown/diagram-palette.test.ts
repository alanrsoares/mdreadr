import { describe, expect, test } from "bun:test";
import { type DiagramPalette, mermaidThemeVariables } from "./diagram-palette.ts";

/** A palette whose every part is a different colour, so a variable given the
 *  wrong part of it is visible as the wrong colour rather than a coincidence. */
const palette: DiagramPalette = {
  background: "rgb(1, 1, 1)",
  nodeFill: "rgb(2, 2, 2)",
  nodeBorder: "rgb(3, 3, 3)",
  nodeText: "rgb(4, 4, 4)",
  text: "rgb(5, 5, 5)",
  mutedText: "rgb(6, 6, 6)",
  line: "rgb(7, 7, 7)",
  clusterFill: "rgb(8, 8, 8)",
  noteFill: "rgb(9, 9, 9)",
  noteBorder: "rgb(10, 10, 10)",
  noteText: "rgb(11, 11, 11)",
  criticalFill: "rgb(12, 12, 12)",
  criticalBorder: "rgb(13, 13, 13)",
  accentText: "rgb(14, 14, 14)",
  fontFamily: "Figtree, sans-serif",
};

const variables = mermaidThemeVariables(palette);

/** One variable's colour, or a failure loud enough to read: a test asserting
 *  about a variable that is not there is asserting nothing. */
const colourOf = (name: string): string => {
  const value = variables[name];
  if (!value) throw new Error(`mermaidThemeVariables names no ${name}`);
  return value;
};

/** The colours the palette offers for text, and the ones it offers to draw
 *  behind text. Nothing may be in both: the bug this guards against is a fill
 *  reaching a text variable, which is how text lands on its own colour. */
const TEXT_PARTS = [
  palette.nodeText,
  palette.text,
  palette.mutedText,
  palette.noteText,
  palette.accentText,
];
const FILL_PARTS = [
  palette.background,
  palette.nodeFill,
  palette.clusterFill,
  palette.noteFill,
  palette.criticalFill,
];

describe("mermaidThemeVariables", () => {
  test("every variable is given a colour: one left out is one mermaid picks", () => {
    for (const [name, value] of Object.entries(variables)) {
      expect(value, name).toBeTruthy();
    }
  });

  test("every variable naming text is given a text colour, never a fill", () => {
    const textVariables = Object.entries(variables).filter(([name]) => /text/i.test(name));
    // Fewer than this and the check has stopped covering what it was written for.
    expect(textVariables.length).toBe(18);

    for (const [name, value] of textVariables) {
      expect(TEXT_PARTS, name).toContain(value);
      expect(FILL_PARTS, name).not.toContain(value);
    }
  });

  test("a node's text and the fill behind it are a pair, not the same colour", () => {
    expect(variables.primaryTextColor).toBe(palette.nodeText);
    expect(variables.primaryColor).toBe(palette.nodeFill);
    expect(variables.primaryTextColor).not.toBe(variables.primaryColor);

    expect(variables.nodeTextColor).not.toBe(variables.mainBkg);
    expect(variables.actorTextColor).not.toBe(variables.actorBkg);
    expect(variables.labelTextColor).not.toBe(variables.labelBoxBkgColor);
    expect(variables.noteTextColor).not.toBe(variables.noteBkgColor);
  });

  test("text drawn on the page takes the page's own text colour", () => {
    expect(variables.textColor).toBe(palette.text);
    expect(variables.titleColor).toBe(palette.text);
    expect(variables.secondaryTextColor).toBe(palette.text);
    expect(variables.tertiaryTextColor).toBe(palette.text);
  });

  test("an edge label punches out of the line behind it with the page's background", () => {
    expect(variables.edgeLabelBackground).toBe(palette.background);
    expect(variables.background).toBe(palette.background);
  });

  test("lines take the visible border, not the near-transparent one", () => {
    expect(variables.lineColor).toBe(palette.line);
    expect(variables.actorLineColor).toBe(palette.line);
  });

  test("a cluster is a surface of its own, distinct from the nodes on it", () => {
    expect(variables.clusterBkg).toBe(palette.clusterFill);
    expect(variables.secondaryColor).toBe(palette.clusterFill);
    expect(variables.clusterBkg).not.toBe(variables.mainBkg);
  });

  test("labels are set in the reader's own family", () => {
    expect(variables.fontFamily).toBe(palette.fontFamily);
  });

  test("nothing carries a `var(...)` through: mermaid derives shades and cannot read one", () => {
    for (const [name, value] of Object.entries(variables)) {
      expect(value.includes("var("), name).toBe(false);
    }
  });
});

/**
 * Variables mermaid's `base` theme falls back to a fixed colour for, read out of
 * mermaid 11.17.2's own `theme-base` defaults. These are the ones no derivation
 * saves: whatever the reader's page is, the diagram draws `lightgrey` there. So
 * each one is either named in the mapping or exempt below with a reason.
 */
const FIXED_IN_BASE: Record<string, string> = {
  altBackground: "#555",
  altSectionBkgColor: "white",
  critBkgColor: "red",
  critBorderColor: "#ff8888",
  doneTaskBkgColor: "lightgrey",
  doneTaskBorderColor: "grey",
  excludeBkgColor: "#eeeeee",
  gridColor: "lightgrey",
  nodeBorder: "#999",
  noteBkgColor: "#fff5ad",
  noteTextColor: "#333",
  pieOuterStrokeColor: "black",
  pieStrokeColor: "black",
  stateBorder: "#000",
  taskTextClickableColor: "#003163",
  todayLineColor: "red",
  transitionColor: "#000",
  vertLineColor: "navy",
};

/** Left to mermaid on purpose, with the reason it is better off there. */
const EXEMPT: Record<string, string> = {
  sequenceNumberColor:
    "text on a circle filled with lineColor; base inverts that fill, which no token here can see",
};

describe("what mermaid is left to decide", () => {
  test("every variable base would fix to a colour of its own is named, or exempt with a reason", () => {
    for (const name of Object.keys(FIXED_IN_BASE)) {
      const named = name in variables;
      const exempt = name in EXEMPT;
      expect(named || exempt, `${name} (base default ${FIXED_IN_BASE[name]})`).toBe(true);
    }
  });

  test("an exemption is a decision, so it carries its reason and stays out", () => {
    for (const [name, reason] of Object.entries(EXEMPT)) {
      expect(variables[name], name).toBeUndefined();
      expect(reason.length, name).toBeGreaterThan(20);
    }
  });

  test("a categorical scale keeps mermaid's palette: one token would flatten it", () => {
    const scales = Object.keys(variables).filter((name) =>
      /^(cScale|git\d|pie\d|em[A-Z])/.test(name),
    );
    expect(scales).toEqual([]);
  });

  test("a gantt chart's finished tasks are a fill of ours under text of ours", () => {
    expect(FILL_PARTS).toContain(colourOf("doneTaskBkgColor"));
    expect(TEXT_PARTS).toContain(colourOf("taskTextColor"));
    expect(variables.doneTaskBkgColor).not.toBe(variables.taskTextColor);
    expect(variables.gridColor).toBe(palette.nodeBorder);
  });

  test("what a diagram calls out as critical uses the reader's own alarm colour", () => {
    expect(variables.critBkgColor).toBe(palette.criticalFill);
    expect(variables.critBorderColor).toBe(palette.criticalBorder);
    expect(variables.todayLineColor).toBe(palette.criticalBorder);
  });

  test("a state's border and a transition are a node's border and an edge", () => {
    expect(variables.stateBorder).toBe(palette.nodeBorder);
    expect(variables.transitionColor).toBe(palette.line);
    expect(variables.altBackground).toBe(palette.clusterFill);
  });

  test("a pie slice keeps its own fill but is outlined in something visible", () => {
    expect(variables.pieStrokeColor).toBe(palette.nodeBorder);
    expect(variables.pieOuterStrokeColor).toBe(palette.nodeBorder);
  });
});
