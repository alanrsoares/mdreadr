/**
 * What a keystroke in the open inline editor means, and which tools that editor
 * offers.
 *
 * The transforms in `inline-edit-ops.ts` are pure and tested; the edge cases
 * that bite are in deciding *which* of them a keystroke asks for — the two-press
 * discard and its amnesia, headings only where a heading is legal, Tab
 * indenting only inside the source and still leaving the toolbar. Those
 * decisions live here, as source in, intent out, so they can be read and tested
 * without a keyboard. `InlineBlockEditor` only dispatches.
 */

import type { BlockAnchor } from "@mdreadr/domain";
import {
  insertLink,
  type Selection,
  setHeadingLevel,
  type TextEdit,
  toggleLinePrefix,
  wrapSelection,
} from "./inline-edit-ops.ts";

export type EditorToolId =
  | "bold"
  | "italic"
  | "code"
  | "strike"
  | "link"
  | "quote"
  | "bullet"
  | "ordered"
  | "heading-1"
  | "heading-2"
  | "heading-3";

/**
 * One toolbar tool, without the glyph that draws it: a tool is what it does to
 * the source and which keystroke asks for it, and neither needs a React node.
 */
export type EditorTool = {
  id: EditorToolId;
  /** Accessible name, without the shortcut: the shortcut rides on the title. */
  label: string;
  /** The letter pressed with the platform's modifier, upper case. */
  shortcut?: string;
  apply: (value: string, selection: Selection) => TextEdit;
};

const FORMAT_TOOLS: readonly EditorTool[] = [
  {
    id: "bold",
    label: "Bold",
    shortcut: "B",
    apply: (value, selection) => wrapSelection(value, selection, "**", "**", "bold text"),
  },
  {
    id: "italic",
    label: "Italic",
    shortcut: "I",
    apply: (value, selection) => wrapSelection(value, selection, "*", "*", "italic text"),
  },
  {
    id: "code",
    label: "Inline code",
    shortcut: "E",
    apply: (value, selection) => wrapSelection(value, selection, "`", "`", "code"),
  },
  {
    id: "strike",
    label: "Strikethrough",
    apply: (value, selection) => wrapSelection(value, selection, "~~", "~~", "strikethrough"),
  },
  { id: "link", label: "Link", shortcut: "K", apply: insertLink },
  {
    id: "quote",
    label: "Quote",
    apply: (value, selection) => toggleLinePrefix(value, selection, "> "),
  },
  {
    id: "bullet",
    label: "Bullet list",
    apply: (value, selection) => toggleLinePrefix(value, selection, "- "),
  },
  {
    id: "ordered",
    label: "Numbered list",
    apply: (value, selection) => toggleLinePrefix(value, selection, "1. "),
  },
];

const HEADING_TOOLS: readonly EditorTool[] = ([1, 2, 3] as const).map((level) => ({
  id: `heading-${level}` as const,
  label: `Heading ${level}`,
  apply: (value: string, selection: Selection) => setHeadingLevel(value, selection, level),
}));

/**
 * The tools on offer for a block. Turning a fenced code block or a table row
 * into a heading is not an edit anyone means to make, so those blocks are not
 * offered the heading tools at all — neither on the toolbar nor by shortcut.
 */
export const toolsFor = (kind: BlockAnchor["kind"]): readonly EditorTool[] =>
  kind === "heading" || kind === "paragraph" ? [...FORMAT_TOOLS, ...HEADING_TOOLS] : FORMAT_TOOLS;

/** What the editor should do about a keystroke. */
export type EditorIntent =
  /** Splice the edited source back into the Draft. */
  | { kind: "apply" }
  /** Close the editor, losing nothing the reader still wants. */
  | { kind: "cancel" }
  /** Ask for a second Escape before throwing away the only copy of the text. */
  | { kind: "armDiscard" }
  | { kind: "tool"; tool: EditorTool }
  | { kind: "indent" }
  | { kind: "outdent" }
  /** Not the editor's keystroke. */
  | { kind: "none" };

/** A keystroke, reduced to what the contract below actually reads. */
export type Keystroke = {
  key: string;
  /** The platform's own modifier — Command on a Mac, Control elsewhere. */
  hasMod: boolean;
  hasAlt: boolean;
  hasShift: boolean;
  /**
   * Whether focus sits in the source rather than on a toolbar button. Escape
   * and apply work from either, but Tab is indentation only in the source: on
   * the toolbar it still moves focus out, which is the only reason the editor
   * is not a keyboard trap.
   */
  isInSource: boolean;
};

/** As much of the open editor as the keystroke's meaning depends on. */
export type EditorSurface = {
  kind: BlockAnchor["kind"];
  /** Whether the text differs from what the block held when it opened. */
  isDirty: boolean;
  /** Whether an Escape has already asked, recently, for a second one. */
  isDiscardArmed: boolean;
};

export const editorIntent = (stroke: Keystroke, surface: EditorSurface): EditorIntent => {
  if (stroke.key === "Escape") {
    // Unchanged text is nothing to lose, and an armed editor has already asked
    // once; anything else gets the second press.
    return !surface.isDirty || surface.isDiscardArmed ? { kind: "cancel" } : { kind: "armDiscard" };
  }

  if (stroke.hasMod && stroke.key === "Enter") return { kind: "apply" };

  if (stroke.hasMod) {
    // Alt is the system's: leave those chords alone rather than eating them.
    if (stroke.hasAlt) return { kind: "none" };
    const tool = toolsFor(surface.kind).find(
      (candidate) => candidate.shortcut === shortcutOf(stroke),
    );
    return tool ? { kind: "tool", tool } : { kind: "none" };
  }

  if (stroke.key === "Tab" && stroke.isInSource) {
    return stroke.hasShift ? { kind: "outdent" } : { kind: "indent" };
  }

  return { kind: "none" };
};

/** The letter a modified keystroke stands for. Backtick is inline code, where
 *  the glyph on the key is the markdown it inserts. */
const shortcutOf = (stroke: Keystroke): string =>
  stroke.key === "`" ? "E" : stroke.key.toUpperCase();

/** Whether the browser's own handling of the keystroke has to be suppressed. A
 *  keystroke the editor acts on is not also the browser's to act on. */
export const swallowsKeystroke = (intent: EditorIntent): boolean => intent.kind !== "none";

/** Whether the keystroke also has to stop before reaching the reader behind the
 *  editor, which binds Escape to its own gestures. */
export const closesTheEditor = (intent: EditorIntent): boolean =>
  intent.kind === "cancel" || intent.kind === "armDiscard";

/**
 * Where an arrow, Home or End moves focus within the toolbar, or `undefined`
 * for a key the toolbar does not own. The toolbar is one Tab stop rather than
 * eleven, so the arrows have to do the walking, and they wrap: the tool after
 * the last one is the first.
 */
export const nextToolIndex = (key: string, from: number, count: number): number | undefined => {
  if (count === 0) return undefined;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const step = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  if (step === 0) return undefined;
  // `from` is negative when focus is not on a tool at all; the walk then starts
  // at whichever end the arrow points away from.
  if (from < 0) return step > 0 ? 0 : count - 1;
  return (from + step + count) % count;
};
