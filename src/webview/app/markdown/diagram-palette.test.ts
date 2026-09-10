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
  fontFamily: "Figtree, sans-serif",
};

const variables = mermaidThemeVariables(palette);

/** The colours the palette offers for text, and the ones it offers to draw
 *  behind text. Nothing may be in both: the bug this guards against is a fill
 *  reaching a text variable, which is how text lands on its own colour. */
const TEXT_PARTS = [palette.nodeText, palette.text, palette.mutedText, palette.noteText];
const FILL_PARTS = [palette.background, palette.nodeFill, palette.clusterFill, palette.noteFill];

describe("mermaidThemeVariables", () => {
  test("every variable is given a colour: one left out is one mermaid picks", () => {
    for (const [name, value] of Object.entries(variables)) {
      expect(value, name).toBeTruthy();
    }
  });

  test("every variable naming text is given a text colour, never a fill", () => {
    const textVariables = Object.entries(variables).filter(([name]) => /text/i.test(name));
    // Fewer than this and the check has stopped covering what it was written for.
    expect(textVariables.length).toBe(10);

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
