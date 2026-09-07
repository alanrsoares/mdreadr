/**
 * Where a link inside a rendered Document points.
 *
 * A markdown Document written for a repository is full of relative links to its
 * neighbours (`[DESIGN.md](DESIGN.md)`), and the reader is a webview: following
 * one navigates the app itself off its own bundle (`views://mainview/...`,
 * `asar_read_file failed`) and the session is gone. So every link is classified
 * before the browser gets it: Documents open in a Tab, in-page fragments scroll,
 * web and mail addresses go to the OS, and everything else is left alone.
 */

export type ReaderLinkTarget =
  /** Another markdown Document on disk. Opens in a Tab. */
  | { kind: "document"; path: string; fragment?: string }
  /** A heading in the Document already open. Scrolls. */
  | { kind: "fragment"; id: string }
  /** A web or mail address. Goes to the OS, never followed in place. */
  | { kind: "external"; url: string }
  /** Anything else: other file types, unresolvable relative paths. */
  | { kind: "other" };

const MARKDOWN_EXTENSION = /\.(md|markdown|mdx)$/i;

const ABSOLUTE_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const EXTERNAL_SCHEME = /^(https?|mailto):/i;

/** `/a/b/c.md` -> `/a/b`. Kept local: the webview has no `node:path`. */
function directoryOf(filePath: string): string {
  const cut = filePath.lastIndexOf("/");
  return cut <= 0 ? "/" : filePath.slice(0, cut);
}

/** Resolves `./x`, `../x` and bare `x` against `base`, without a URL parse:
 *  document paths can contain characters a URL would re-encode. */
function resolveAgainst(base: string, relative: string): string {
  let segments = base.split("/").filter((segment) => segment.length > 0);

  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") continue;
    segments = segment === ".." ? segments.slice(0, -1) : segments.concat(segment);
  }

  return `/${segments.join("/")}`;
}

/**
 * Classifies one `href` from a rendered Document. `documentPath` is the absolute
 * path of the Document the link was found in, and is what relative links
 * resolve against; without it, a relative link cannot be resolved and is left
 * alone rather than guessed at.
 */
export function resolveReaderLink(href: string, documentPath?: string): ReaderLinkTarget {
  const trimmed = href.trim();
  if (trimmed.length === 0) return { kind: "other" };

  if (trimmed.startsWith("#")) {
    const id = decodeURIComponent(trimmed.slice(1));
    return id.length > 0 ? { kind: "fragment", id } : { kind: "other" };
  }

  if (ABSOLUTE_SCHEME.test(trimmed)) {
    // Only what belongs to the outside world. `views:`, `file:` and
    // Windows-style `C:` are not links a Document gets to follow.
    return EXTERNAL_SCHEME.test(trimmed) ? { kind: "external", url: trimmed } : { kind: "other" };
  }

  const [pathPart = "", fragment] = trimmed.split("#", 2);
  const withoutQuery = pathPart.split("?", 1)[0] ?? "";
  if (!MARKDOWN_EXTENSION.test(withoutQuery)) return { kind: "other" };

  const decoded = decodeURIComponent(withoutQuery);
  const path = decoded.startsWith("/")
    ? decoded
    : documentPath
      ? resolveAgainst(directoryOf(documentPath), decoded)
      : undefined;

  if (!path) return { kind: "other" };

  return fragment ? { kind: "document", path, fragment } : { kind: "document", path };
}
