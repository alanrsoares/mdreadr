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
