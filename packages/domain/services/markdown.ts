export type TocEntry = {
  id: string;
  level: number;
  text: string;
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

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!match) continue;

    const level = match[1]?.length ?? 1;
    const text = match[2]?.trim() ?? "";
    const base = slugify(text);
    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;

    entries.push({ id, level, text });
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

export function blockIdForParagraph(text: string, occurrence: number): string {
  return `paragraph-${hashBlockContent(text)}-${occurrence}`;
}

export function blockIdForCode(
  code: string,
  language: string | undefined,
  occurrence: number,
): string {
  const key = `${language ?? ""}\n${code}`;
  return `code-${hashBlockContent(key)}-${occurrence}`;
}

export function truncateAnchorLabel(text: string, maxLength = 72): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1)}…`;
}
