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
