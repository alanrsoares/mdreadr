const LINKED_IMAGE_RE = /\[!\[([^\]\n]*)\]\(([^)\n]+)\)\]\(([^)\n]+)\)/g;
const BADGE_LINE_RE = /^\[\[\[BADGE:\{.*?\}\]\]\]$/;
const BADGE_TOKEN_RE = /\[\[\[BADGE:(\{.*?\})\]\]\]/g;

export const encodeLinkedBadge = (alt: string, src: string, href: string): string =>
  `[[[BADGE:${JSON.stringify({ alt, src, href })}]]]`;

/** Normalise markdown before Astryx parsing. */
export function preprocessReaderMarkdown(content: string): string {
  return mapOutsideCodeFences(content, (chunk) =>
    convertAlignWrappers(
      convertBadgeRowsToBlocks(
        collapseBadgeRows(
          convertGitHubAlerts(
            convertLinkedImages(convertBlockMath(stripHtmlComments(decodeHtmlEntities(chunk)))),
          ),
        ),
      ),
    ),
  );
}

// <div align> / <p align> wrappers, the GitHub README hero-block idiom. The
// payload goes into an `align` fence JSON-encoded, so one escaped line can
// never close the fence; AlignBlock re-runs the reader preprocess on the
// decoded body at render time. Must run LAST in the pipeline — an earlier
// transform rewriting the body after encoding (e.g. badge conversion) would
// inject unescaped quotes into the JSON line and corrupt it. Non-greedy to
// the first closing tag — nested same-tag wrappers are out of scope, and
// fenced code inside a wrapper stays a literal <div> because
// mapOutsideCodeFences splits it away before this runs.
const ALIGN_WRAPPER_RE =
  /<(div|p)\s+align\s*=\s*["']?(center|left|right)["']?\s*>\n?([\s\S]*?)\n?<\/\1>/gi;

export function convertAlignWrappers(content: string): string {
  return content.replace(ALIGN_WRAPPER_RE, (_full, _tag, align, body) => {
    const payload = JSON.stringify({
      align: String(align).toLowerCase(),
      body: String(body).trim(),
    });
    return `\n\`\`\`align\n${payload}\n\`\`\`\n`;
  });
}

/** GitHub hides HTML comments; Astryx would render them as literal text. */
export function stripHtmlComments(content: string): string {
  return mapOutsideInlineCode(content, (text) => text.replace(/<!--[\s\S]*?-->/g, ""));
}

/** `&nbsp;` is the common badge/hero spacer; GitHub decodes it, Astryx shows it verbatim. */
export function decodeHtmlEntities(content: string): string {
  return mapOutsideInlineCode(content, (text) => text.replace(/&nbsp;/gi, " "));
}

function mapOutsideInlineCode(content: string, transform: (text: string) => string): string {
  const parts = content.split(/(`[^`\n]*`)/g);
  return parts.map((part, index) => (index % 2 === 1 ? part : transform(part))).join("");
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
