/**
 * Pure markdown source transforms behind the inline block editor's toolbar and
 * shortcuts. They take the textarea's value plus its selection and return the
 * next value plus where the selection should land, so the component only has
 * to write both back to the DOM. Kept out of the component because this is the
 * part with the edge cases: toggling markers back off, multi-line list
 * prefixes, caret drift after a prefix changes length.
 */

export type Selection = {
  start: number;
  end: number;
};

export type TextEdit = {
  text: string;
  selection: Selection;
};

const INDENT = "  ";

const WORD_CHAR = /[\p{L}\p{N}_-]/u;

const HEADING_PREFIX = /^(#{1,6})\s+/;

const URL_LIKE = /^(https?:\/\/|mailto:|\/|\.{1,2}\/|#)\S*$/i;

const at = (value: string, index: number): string => value.slice(index, index + 1);

/** The word under a collapsed caret, so `⌘B` mid-word bolds the word rather
 *  than dropping an empty pair of markers into it. */
function wordAround(value: string, caret: number): Selection {
  let start = caret;
  let end = caret;
  while (start > 0 && WORD_CHAR.test(at(value, start - 1))) start -= 1;
  while (end < value.length && WORD_CHAR.test(at(value, end))) end += 1;
  return { start, end };
}

type LineSpan = {
  start: number;
  end: number;
};

/** Source range of every line the selection touches, whole lines. */
function linesInRange(value: string, selection: Selection): LineSpan[] {
  const first = value.lastIndexOf("\n", selection.start - 1) + 1;
  const lastBreak = value.indexOf("\n", selection.end);
  const last = lastBreak === -1 ? value.length : lastBreak;

  const spans: LineSpan[] = [];
  let cursor = first;
  while (cursor <= last) {
    const breakAt = value.indexOf("\n", cursor);
    const end = breakAt === -1 || breakAt > last ? last : breakAt;
    spans.push({ start: cursor, end });
    cursor = end + 1;
  }
  return spans;
}

function replaceLines(
  value: string,
  spans: LineSpan[],
  rewrite: (line: string) => string,
): { text: string; firstDelta: number; totalDelta: number } {
  let text = "";
  let cursor = 0;
  let firstDelta = 0;
  let totalDelta = 0;

  spans.forEach((span, index) => {
    const line = value.slice(span.start, span.end);
    const next = rewrite(line);
    const delta = next.length - line.length;
    if (index === 0) firstDelta = delta;
    totalDelta += delta;
    text += value.slice(cursor, span.start) + next;
    cursor = span.end;
  });

  return { text: text + value.slice(cursor), firstDelta, totalDelta };
}

/**
 * Wraps the selection in `before`/`after`, or unwraps it when the markers are
 * already there. A collapsed caret wraps the word it sits in, and falls back to
 * inserting `placeholder` pre-selected when there is no word to take.
 */
export function wrapSelection(
  value: string,
  selection: Selection,
  before: string,
  after: string,
  placeholder: string,
): TextEdit {
  const range = selection.start === selection.end ? wordAround(value, selection.start) : selection;
  const selected = value.slice(range.start, range.end);

  if (selected.length > 0) {
    const beforeLen = before.length;
    const afterLen = after.length;
    const isWrapped =
      range.start >= beforeLen &&
      value.slice(range.start - beforeLen, range.start) === before &&
      value.slice(range.end, range.end + afterLen) === after;

    if (isWrapped) {
      return {
        text:
          value.slice(0, range.start - beforeLen) + selected + value.slice(range.end + afterLen),
        selection: { start: range.start - beforeLen, end: range.end - beforeLen },
      };
    }

    return {
      text: value.slice(0, range.start) + before + selected + after + value.slice(range.end),
      selection: { start: range.start + beforeLen, end: range.end + beforeLen },
    };
  }

  return {
    text: value.slice(0, range.start) + before + placeholder + after + value.slice(range.end),
    selection: {
      start: range.start + before.length,
      end: range.start + before.length + placeholder.length,
    },
  };
}

/**
 * Adds `prefix` to every line the selection touches, or strips it from all of
 * them when every line already has it. Multi-line on purpose: selecting three
 * lines and asking for a bullet list should produce three bullets.
 */
export function toggleLinePrefix(value: string, selection: Selection, prefix: string): TextEdit {
  const spans = linesInRange(value, selection);
  const lines = spans.map((span) => value.slice(span.start, span.end));
  const allPrefixed = lines.every((line) => line.startsWith(prefix));

  const { text, firstDelta, totalDelta } = replaceLines(value, spans, (line) =>
    allPrefixed ? line.slice(prefix.length) : prefix + line,
  );

  const start = Math.max(spans[0]?.start ?? 0, selection.start + firstDelta);
  const end = Math.max(start, selection.end + totalDelta);
  return { text, selection: { start, end } };
}

/**
 * Sets the caret line's heading level, or clears it when the line is already at
 * that level, so the same button toggles back to a paragraph.
 */
export function setHeadingLevel(value: string, selection: Selection, level: number): TextEdit {
  const span = linesInRange(value, { start: selection.start, end: selection.start })[0];
  if (!span) return { text: value, selection };

  const line = value.slice(span.start, span.end);
  const current = HEADING_PREFIX.exec(line);
  const body = line.replace(HEADING_PREFIX, "");
  const nextLine = current?.[1]?.length === level ? body : `${"#".repeat(level)} ${body}`;

  const delta = nextLine.length - line.length;
  const caret = Math.max(
    span.start,
    Math.min(span.start + nextLine.length, selection.start + delta),
  );
  return {
    text: value.slice(0, span.start) + nextLine + value.slice(span.end),
    selection: { start: caret, end: caret },
  };
}

/**
 * `[text](url)`. A selection that reads like a URL becomes the target and the
 * label is pre-selected; anything else becomes the label with `url` selected,
 * so the next keystroke lands where the user has to type either way.
 */
export function insertLink(value: string, selection: Selection): TextEdit {
  const range = selection.start === selection.end ? wordAround(value, selection.start) : selection;
  const selected = value.slice(range.start, range.end);
  const head = value.slice(0, range.start);
  const tail = value.slice(range.end);

  if (selected.length > 0 && URL_LIKE.test(selected)) {
    return {
      text: `${head}[text](${selected})${tail}`,
      selection: { start: range.start + 1, end: range.start + 5 },
    };
  }

  const label = selected.length > 0 ? selected : "link";
  const urlStart = range.start + label.length + 3;
  return {
    text: `${head}[${label}](url)${tail}`,
    selection: { start: urlStart, end: urlStart + 3 },
  };
}

/** Two spaces at the caret, or a whole-line indent when the selection spans
 *  lines. `outdent` removes one level from the same lines. */
export function indent(value: string, selection: Selection): TextEdit {
  const spans = linesInRange(value, selection);

  if (spans.length < 2) {
    const caret = selection.start + INDENT.length;
    return {
      text: value.slice(0, selection.start) + INDENT + value.slice(selection.end),
      selection: { start: caret, end: caret },
    };
  }

  const { text, firstDelta, totalDelta } = replaceLines(value, spans, (line) => INDENT + line);
  return {
    text,
    selection: { start: selection.start + firstDelta, end: selection.end + totalDelta },
  };
}

export function outdent(value: string, selection: Selection): TextEdit {
  const spans = linesInRange(value, selection);
  const { text, firstDelta, totalDelta } = replaceLines(value, spans, (line) =>
    line.startsWith(INDENT) ? line.slice(INDENT.length) : line.replace(/^[ \t]/, ""),
  );

  const start = Math.max(spans[0]?.start ?? 0, selection.start + firstDelta);
  return { text, selection: { start, end: Math.max(start, selection.end + totalDelta) } };
}
