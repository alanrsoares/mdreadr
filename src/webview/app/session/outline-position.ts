import type { TocEntry } from "@mdreadr/domain";
import { blockIdForHeading } from "@mdreadr/domain";

/**
 * The outline entry a source line belongs under: the last heading at or above
 * it. Before the first heading nothing is active, which matches the reader's
 * scroll spy - a document's preamble belongs to no section.
 *
 * `line` is 0-based, as `TocEntry.line` is.
 */
export function outlineIdAtLine(entries: readonly TocEntry[], line: number): string | undefined {
  let active: TocEntry | undefined;

  for (const entry of entries) {
    if (entry.line > line) break;
    active = entry;
  }

  return active ? blockIdForHeading(active) : undefined;
}
