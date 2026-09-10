import type { ColorScheme } from "../theme/color-scheme-container.ts";

/**
 * The reader's own colours, handed to a diagram renderer that would otherwise
 * pick its own.
 *
 * Mermaid ships palettes (`dark`, `neutral`) and bakes them into the SVG it
 * returns. Two palettes then have to agree about the page they are drawn on:
 * mermaid's, chosen once, and the reader's, which the user can change at any
 * time. When they disagree the diagram is unreadable — most sharply when a
 * label's colour is inherited from the page while the box behind it came from
 * mermaid, so light text lands on a light box.
 *
 * So mermaid is given no palette to choose. Every colour it draws is named here
 * from the same tokens the rest of the reader uses, which means a box and the
 * text inside it are a pair the theme already pairs, in either scheme, with
 * nothing left to inherit.
 */

/** The parts of a diagram that need a colour, named for what they are rather
 *  than for whichever renderer is drawing them. */
export type DiagramPalette = {
  /** The page behind the diagram. */
  background: string;
  /** A node's fill, a shade off the page so its edges read. */
  nodeFill: string;
  nodeBorder: string;
  /** Text inside a node — the theme's own partner for `nodeFill`. */
  nodeText: string;
  /** Text on the page itself: titles, edge labels. */
  text: string;
  /** Text that is present but secondary. */
  mutedText: string;
  /** Edges, and anything else drawn as a line. */
  line: string;
  /** A cluster or subgraph, behind the nodes it holds. */
  clusterFill: string;
  noteFill: string;
  noteBorder: string;
  noteText: string;
  fontFamily: string;
};

/** Which reader token stands for each part. */
const PALETTE_TOKENS = {
  background: "--color-background-body",
  nodeFill: "--color-background-surface",
  nodeBorder: "--color-border-emphasized",
  nodeText: "--color-text-primary",
  text: "--color-text-primary",
  mutedText: "--color-text-secondary",
  // Not `--color-border`, which is nearly transparent: an edge has nothing
  // behind it to sit against, so it needs a line the reader can actually see.
  line: "--color-border-emphasized",
  clusterFill: "--color-background-muted",
  noteFill: "--color-background-yellow",
  noteBorder: "--color-border-yellow",
  noteText: "--color-text-primary",
} as const satisfies Record<Exclude<keyof DiagramPalette, "fontFamily">, string>;

const FONT_TOKEN = "--font-family-body";

/**
 * Reads the tokens as the browser has resolved them for the scheme in force.
 *
 * Through a probe rather than `getPropertyValue`: a custom property comes back
 * as the text that was written for it, and these are written `light-dark(…)`,
 * which is a pair of colours and not yet a colour. Set as a real `color` it
 * resolves to one, so the probe is what makes the answer a colour at all.
 *
 * `within` has to sit inside the themed element, since the tokens are scoped
 * to it. `scheme` is declared on the probe rather than read off the document:
 * it is the reader's own setting, and the probe should not have to wait for the
 * attribute that mirrors it onto `<html>` to be in place. Every property is
 * read after every write, so this costs one layout recalculation rather than
 * one per token.
 */
export const readDiagramPalette = (within: HTMLElement, scheme: ColorScheme): DiagramPalette => {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = `position:absolute;width:0;height:0;overflow:hidden;color-scheme:${scheme}`;

  const entries = Object.entries(PALETTE_TOKENS);
  const cells = entries.map(([, token]) => {
    const cell = document.createElement("span");
    cell.style.color = `var(${token})`;
    probe.appendChild(cell);
    return cell;
  });
  const fontCell = document.createElement("span");
  fontCell.style.fontFamily = `var(${FONT_TOKEN})`;
  probe.appendChild(fontCell);

  within.appendChild(probe);
  const read = Object.fromEntries(
    entries.map(([part], index) => [part, getComputedStyle(cells[index] as Element).color]),
  ) as Omit<DiagramPalette, "fontFamily">;
  const fontFamily = getComputedStyle(fontCell).fontFamily;
  probe.remove();

  return { ...read, fontFamily };
};

/**
 * The palette in mermaid's own vocabulary, for its `base` theme — the one theme
 * that derives everything from what it is given rather than from a palette of
 * its own.
 *
 * Every variable mermaid would otherwise default is named, and every one that
 * names text is given a text colour whose fill partner is named alongside it.
 * That pairing is the whole point: a variable left out here is a colour mermaid
 * picks, and a colour mermaid picks is a colour the reader's page did not.
 */
export const mermaidThemeVariables = (palette: DiagramPalette): Record<string, string> => ({
  background: palette.background,
  fontFamily: palette.fontFamily,

  // Nodes, and the flowchart shapes drawn the same way.
  primaryColor: palette.nodeFill,
  primaryTextColor: palette.nodeText,
  primaryBorderColor: palette.nodeBorder,
  mainBkg: palette.nodeFill,
  nodeBorder: palette.nodeBorder,
  nodeTextColor: palette.nodeText,

  // Clusters and subgraphs: a second surface, holding nodes of the first.
  secondaryColor: palette.clusterFill,
  secondaryTextColor: palette.text,
  secondaryBorderColor: palette.nodeBorder,
  tertiaryColor: palette.clusterFill,
  tertiaryTextColor: palette.text,
  tertiaryBorderColor: palette.nodeBorder,
  clusterBkg: palette.clusterFill,
  clusterBorder: palette.nodeBorder,

  // Edges and their labels. An edge label sits on the page, not on a node, so
  // it takes the page's own background to punch out of the line behind it.
  lineColor: palette.line,
  textColor: palette.text,
  edgeLabelBackground: palette.background,
  titleColor: palette.text,

  // Sequence diagrams: actors are nodes, signals are edges, notes are notes.
  actorBkg: palette.nodeFill,
  actorBorder: palette.nodeBorder,
  actorTextColor: palette.nodeText,
  actorLineColor: palette.line,
  signalColor: palette.text,
  signalTextColor: palette.text,
  labelBoxBkgColor: palette.nodeFill,
  labelBoxBorderColor: palette.nodeBorder,
  labelTextColor: palette.nodeText,
  loopTextColor: palette.text,
  activationBkgColor: palette.clusterFill,
  activationBorderColor: palette.nodeBorder,
  sequenceNumberColor: palette.nodeFill,

  noteBkgColor: palette.noteFill,
  noteBorderColor: palette.noteBorder,
  noteTextColor: palette.noteText,
});
