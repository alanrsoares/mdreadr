import type { TocEntry } from "@mdreadr/domain";

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/** Line indexes that sit inside (or on the edge of) a fenced code block. */
export function fencedLines(markdown: string): Set<number> {
  const fenced = new Set<number>();
  let open: { char: string; length: number } | null = null;

  for (const [index, line] of markdown.split("\n").entries()) {
    const marker = FENCE_RE.exec(line)?.[1];
    if (open === null) {
      if (!marker) continue;
      open = { char: marker.charAt(0), length: marker.length };
      fenced.add(index);
    } else {
      fenced.add(index);
      if (marker && marker.charAt(0) === open.char && marker.length >= open.length) open = null;
    }
  }

  return fenced;
}

/**
 * Position of an outline entry among the headings Write renders. The outline
 * lists every `#` line, but a `# comment` inside a fence is code in Write, not a
 * heading, so those lines are not counted. -1 when the entry is itself fenced.
 */
export function writeHeadingIndex(markdown: string, toc: TocEntry[], entry: TocEntry): number {
  const fenced = fencedLines(markdown);
  const rendered = toc.filter((candidate) => !fenced.has(candidate.line));
  return rendered.indexOf(entry);
}
