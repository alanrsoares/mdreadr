/**
 * Where a search term sits in a Document, and which match the reader is on.
 *
 * Both surfaces share this: Preview searches the text it rendered, Edit
 * searches the source, and the arithmetic for "next"/"previous" is the same on
 * either. Kept pure so the wrapping and the empty cases are tested rather than
 * discovered in the one place a match count can be wrong.
 */

export type FindMatch = { start: number; end: number };

/**
 * Every occurrence of `query` in `haystack`, in order, non-overlapping.
 *
 * Plain substring, case-insensitive: a reviewer typing `useMemo(` into a search
 * box means those characters, and a regex would turn every bracket in a code
 * fence into a syntax error they have to debug. Lower-casing can change a
 * string's length in some locales, so the scan compares in lower case but
 * measures in the original.
 */
export function findMatches(haystack: string, query: string): FindMatch[] {
  if (query === "" || haystack === "") return [];

  const hay = haystack.toLowerCase();
  const needle = query.toLowerCase();
  const matches: FindMatch[] = [];

  let from = 0;
  while (from <= hay.length - needle.length) {
    const start = hay.indexOf(needle, from);
    if (start === -1) break;
    matches.push({ start, end: start + query.length });
    from = start + needle.length;
  }

  return matches;
}

/**
 * The match index a step lands on, wrapping at both ends. `-1` when there is
 * nothing to step through, which is what the counter reads as "0 of 0".
 */
export function stepMatch(count: number, current: number, direction: 1 | -1): number {
  if (count <= 0) return -1;
  if (current < 0) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
}

/**
 * The match to land on when the term changes while the reader is somewhere in
 * the Document: the first one at or after `anchor`, so typing another letter
 * keeps them where they are reading instead of throwing them back to the top.
 */
export function matchNearestTo(matches: FindMatch[], anchor: number): number {
  if (matches.length === 0) return -1;
  const index = matches.findIndex((match) => match.start >= anchor);
  return index === -1 ? 0 : index;
}
