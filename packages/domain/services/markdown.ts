export type TocEntry = {
  id: string;
  level: number;
  text: string;
  /** 0-based index of the source line the heading sits on. */
  line: number;
};

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

export function extractHeadings(markdown: string): TocEntry[] {
  const lines = markdown.split("\n");
  const entries: TocEntry[] = [];
  const slugCounts = new Map<string, number>();

  for (const [lineIndex, line] of lines.entries()) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!match) continue;

    const level = match[1]?.length ?? 1;
    const text = match[2]?.trim() ?? "";
    const base = slugify(text);
    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;

    entries.push({ id, level, text, line: lineIndex });
  }

  return entries;
}

/**
 * YAML frontmatter is metadata, not prose: GitHub and every markdown reader hide
 * it, and left in it does worse than show itself — `title: mdreadr` followed by
 * the closing `---` is a setext h2, so the first thing a Document shows is a
 * fake heading that also lands in the outline.
 *
 * Runs before every other transform and before the fence split: the opening
 * delimiter is only frontmatter on line 1, where no code fence can have opened
 * yet. An unterminated block is left alone — it is a thematic break and a
 * paragraph the author meant to write.
 */
export function stripFrontmatter(content: string): string {
  if (!/^---[ \t]*\r?\n/.test(content)) return content;

  const lines = content.split("\n");
  const closing = lines.findIndex(
    (line, index) => index > 0 && /^(---|\.\.\.)[ \t\r]*$/.test(line),
  );
  if (closing === -1) return content;

  return lines
    .slice(closing + 1)
    .join("\n")
    .replace(/^\s*\n/, "");
}

/** Prose-only word count and the reading time it implies. */
export type DocumentStats = { words: number; minutes: number };

/** Technical prose, read attentively rather than skimmed. */
const WORDS_PER_MINUTE = 200;

/** Both fence spellings CommonMark allows; a `~~~` block is as unread as a ``` one. */
const FENCED_BLOCK = /^(```|~~~)[\s\S]*?^\1/gm;

/**
 * Counts what the reader actually reads: frontmatter and fenced code are the
 * two things a Document carries in bulk that nobody reads word by word, and
 * counting them turns a short page with one long listing into a "20 min read".
 * Inline markers are left in — stripping them costs a second parse to move a
 * count that rounds away.
 */
export function documentStats(markdown: string): DocumentStats {
  const prose = stripFrontmatter(markdown).replace(FENCED_BLOCK, " ");
  const words = prose.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  return { words, minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) };
}

export const blockIdForHeading = (entry: TocEntry): string => `heading-${entry.id}`;

/** FNV-1a 32-bit — stable across reloads, sync, no crypto dependency */
export function hashBlockContent(text: string): string {
  let hash = 0x811c9dc5;
  const normalized = text.replace(/\s+/g, " ").trim();
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export const blockIdForParagraph = (text: string, occurrence: number): string =>
  `paragraph-${hashBlockContent(text)}-${occurrence}`;

export function blockIdForCode(
  code: string,
  language: string | undefined,
  occurrence: number,
): string {
  const key = `${language ?? ""}\n${code}`;
  return `code-${hashBlockContent(key)}-${occurrence}`;
}

export const blockIdForList = (text: string, occurrence: number): string =>
  `list-${hashBlockContent(text)}-${occurrence}`;

export const blockIdForTable = (text: string, occurrence: number): string =>
  `table-${hashBlockContent(text)}-${occurrence}`;

export function truncateAnchorLabel(text: string, maxLength = 72): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length <= maxLength ? singleLine : `${singleLine.slice(0, maxLength - 1)}…`;
}

const MARKDOWN_EXTENSIONS = [".md", ".markdown"];

// What a webview can decode on its own, so the reader can hand it the bytes
// and stop there. TIFF and friends stay out: no browser renders them.
const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".bmp",
  ".ico",
];

/**
 * How a Document is presented: prose with a source toggle, a picture, or
 * source only — anything the app can open but cannot render as markdown.
 */
export type DocumentKind = "markdown" | "image" | "source";

const hasExtension = (path: string, extensions: string[]): boolean => {
  const lower = path.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension));
};

/** True for paths the reader can render as prose. */
export function isMarkdownPath(path: string): boolean {
  return hasExtension(path, MARKDOWN_EXTENSIONS);
}

export function documentKindForPath(path: string): DocumentKind {
  if (isMarkdownPath(path)) return "markdown";
  return hasExtension(path, IMAGE_EXTENSIONS) ? "image" : "source";
}
