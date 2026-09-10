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
  /** Something the diagram is calling out as wrong or urgent: a gantt chart's
   *  critical path, the line marking today. */
  criticalFill: string;
  criticalBorder: string;
  /** Text that is also a link. */
  accentText: string;
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
  criticalFill: "--color-background-red",
  criticalBorder: "--color-border-red",
  accentText: "--color-text-accent",
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
 * Every variable that names text is given a text colour whose fill partner is
 * named alongside it. That pairing is the whole point: a text colour and the
 * fill behind it have to be chosen together or they are chosen by nobody.
 *
 * What is named here, and what is not: `base` fills the rest in from these
 * values, so most of what is left out still ends up the reader's colours by
 * derivation. Two kinds do not, and only one of them is a problem.
 *
 * - Variables `base` falls back to a **fixed colour** — `gridColor` is
 *   `lightgrey`, `altSectionBkgColor` is `white`, `stateBorder` is `#000`,
 *   `critBkgColor` is `red` — ignore the reader entirely. A gantt chart in the
 *   dark scheme draws its finished tasks `lightgrey` and then labels them in the
 *   page's own light text. Those are named below.
 * - Variables holding a **categorical scale** — `cScale0…`, `git0…`, the pie
 *   slice colours — are meant to differ from one another, so one token in their
 *   place would flatten every category into the same colour. Those keep
 *   mermaid's palette, and with it mermaid's own contrast for their labels.
 *   A journey or a git graph therefore still looks like mermaid's; it is the one
 *   place that is deliberate rather than overlooked.
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
  // `sequenceNumberColor` is left out on purpose. It is text on a circle filled
  // with `lineColor`, and `base` defaults it to the inverse of that fill —
  // better informed than any token here, which knows the page but not the
  // circle. A surface colour there is low contrast; `lineColor` itself is
  // invisible.

  noteBkgColor: palette.noteFill,
  noteBorderColor: palette.noteBorder,
  noteTextColor: palette.noteText,

  // Gantt charts. `base` leaves most of this fixed: grey grid lines, white
  // alternating bands, grey finished tasks, red for the critical path — all
  // drawn under the page's own text colour.
  sectionBkgColor: palette.clusterFill,
  sectionBkgColor2: palette.background,
  altSectionBkgColor: palette.background,
  excludeBkgColor: palette.clusterFill,
  gridColor: palette.nodeBorder,
  taskBkgColor: palette.nodeFill,
  taskBorderColor: palette.nodeBorder,
  taskTextColor: palette.nodeText,
  taskTextLightColor: palette.nodeText,
  taskTextDarkColor: palette.nodeText,
  taskTextOutsideColor: palette.text,
  taskTextClickableColor: palette.accentText,
  activeTaskBkgColor: palette.clusterFill,
  activeTaskBorderColor: palette.nodeBorder,
  doneTaskBkgColor: palette.clusterFill,
  doneTaskBorderColor: palette.nodeBorder,
  critBkgColor: palette.criticalFill,
  critBorderColor: palette.criticalBorder,
  todayLineColor: palette.criticalBorder,
  vertLineColor: palette.line,

  // State diagrams: a transition is an edge, a state is a node, and a composite
  // state is a cluster holding more of them.
  stateBkg: palette.nodeFill,
  stateBorder: palette.nodeBorder,
  stateLabelColor: palette.nodeText,
  labelBackgroundColor: palette.nodeFill,
  transitionColor: palette.line,
  transitionLabelColor: palette.text,
  altBackground: palette.clusterFill,
  compositeBackground: palette.clusterFill,
  compositeTitleBackground: palette.nodeFill,
  compositeBorder: palette.nodeBorder,

  // Pie charts keep mermaid's slice colours; only the strokes around them are
  // fixed black, which on a dark page is a slice outlined in nothing.
  pieStrokeColor: palette.nodeBorder,
  pieOuterStrokeColor: palette.nodeBorder,
  pieTitleTextColor: palette.text,
  pieLegendTextColor: palette.text,

  // The message a failed diagram draws in place of itself.
  errorBkgColor: palette.criticalFill,
  errorTextColor: palette.text,
});
