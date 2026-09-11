/**
 * The `#fragment` on a link between Documents, held from the click that opened
 * the Tab until that Tab has the Document rendered to scroll inside.
 *
 * A module-level one-shot rather than a prop: the click happens in the Document
 * the reader is leaving, the scroll happens in one that does not exist yet, and
 * every layer between them (the Tab list, the session query) would otherwise
 * have to carry a field that means nothing to it.
 *
 * Keyed by path and taken once. A fragment that never gets claimed — the
 * Document failed to open, or it has no such heading — is replaced by the next
 * link click rather than accumulating.
 */

let pending: { path: string; fragment: string } | null = null;

/** Records the fragment to apply once `path` is open. */
export function requestFragment(path: string, fragment: string): void {
  pending = { path, fragment };
}

/** The fragment waiting for `path`, if any. Consumed: a second call gets `null`. */
export function takeFragment(path: string): string | null {
  if (pending?.path !== path) return null;
  const { fragment } = pending;
  pending = null;
  return fragment;
}

/** Test seam. */
export function clearPendingFragment(): void {
  pending = null;
}
