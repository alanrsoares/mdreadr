const LINKED_IMAGE_RE = /\[!\[([^\]\n]*)\]\(([^)\n]+)\)\]\(([^)\n]+)\)/g;
const BADGE_LINE_RE = /^\[\[\[BADGE:\{.*?\}\]\]\]$/;
const BADGE_TOKEN_RE = /\[\[\[BADGE:(\{.*?\})\]\]\]/g;

export const encodeLinkedBadge = (alt: string, src: string, href: string): string =>
  `[[[BADGE:${JSON.stringify({ alt, src, href })}]]]`;

/** Normalise markdown before Astryx parsing. */
export function preprocessReaderMarkdown(content: string): string {
  return mapOutsideCodeFences(content, (chunk) =>
    convertBadgeRowsToBlocks(
      collapseBadgeRows(convertGitHubAlerts(convertLinkedImages(convertBlockMath(chunk)))),
    ),
  );
}

function mapOutsideCodeFences(content: string, transform: (chunk: string) => string): string {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => (index % 2 === 1 ? part : transform(part))).join("");
}

function convertBlockMath(content: string): string {
  return content.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const body = String(tex).trim();
    return `\n\`\`\`math\n${body}\n\`\`\`\n`;
  });
}

function convertLinkedImages(content: string): string {
  return content.replace(LINKED_IMAGE_RE, (_, alt, src, href) =>
    encodeLinkedBadge(String(alt), String(src), String(href)),
  );
}

/** GitHub READMEs often put one badge per line — merge into a single inline row. */
function collapseBadgeRows(content: string): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let badgeRun: string[] = [];

  const flushBadges = () => {
    if (badgeRun.length === 0) return;
    output.push(badgeRun.join(" "));
    badgeRun = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (BADGE_LINE_RE.test(trimmed)) {
      badgeRun.push(trimmed);
      continue;
    }

    flushBadges();
    output.push(line);
  }

  flushBadges();
  return output.join("\n");
}

function convertBadgeRowsToBlocks(content: string): string {
  return content.replace(/^([ \t]*(?:\[\[\[BADGE:\{.*?\}\]\]\][ \t]*)+)$/gm, (line) => {
    const badges = [...line.trim().matchAll(BADGE_TOKEN_RE)].map((match) =>
      JSON.parse(match[1] ?? "{}"),
    );
    return `\`\`\`badges\n${JSON.stringify(badges)}\n\`\`\``;
  });
}

function convertGitHubAlerts(content: string): string {
  return content.replace(/^>\s*\[!([A-Z]+)\]\s*$/gm, (_, type) => {
    const label = type.charAt(0) + type.slice(1).toLowerCase();
    return `> **${label}**`;
  });
}
