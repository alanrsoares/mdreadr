import type { MarkdownInlinePlugin } from "@astryxdesign/core/Markdown";
import { z } from "zod";
import { ReaderBadgeRow } from "../ui/layout.tsx";
import { LINKED_BADGE_TOKEN_SOURCE } from "./preprocess.ts";

const linkedBadgePayloadSchema = z.object({
  alt: z.string(),
  src: z.string(),
  href: z.string(),
});
export type LinkedBadgePayload = z.infer<typeof linkedBadgePayloadSchema>;

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const LinkedBadge = ({ alt, src, href }: LinkedBadgePayload) =>
  !isSafeUrl(src) || !isSafeUrl(href) ? (
    <span>[{alt}]</span>
  ) : (
    <a className="reader-badge-link" href={href} rel="noopener noreferrer" target="_blank">
      <img alt={alt} className="reader-badge" loading="lazy" src={src} />
    </a>
  );

type BadgeRowProps = { badges: LinkedBadgePayload[] };

export const BadgeRow = ({ badges }: BadgeRowProps) => (
  <ReaderBadgeRow>
    {badges.map((badge) => (
      <LinkedBadge key={`${badge.href}:${badge.src}`} {...badge} />
    ))}
  </ReaderBadgeRow>
);

export function parseBadgeBlock(code: string): LinkedBadgePayload[] | null {
  try {
    const parsed = JSON.parse(code);
    return !Array.isArray(parsed)
      ? null
      : parsed.filter(
          (item): item is LinkedBadgePayload => linkedBadgePayloadSchema.safeParse(item).success,
        );
  } catch {
    return null;
  }
}

/** Fallback for badge tokens left inline inside mixed paragraphs. */
export const linkedBadgePlugin: MarkdownInlinePlugin = {
  // Fresh instance — never share a stateful /g regex object with preprocess.ts's replace pass.
  pattern: new RegExp(LINKED_BADGE_TOKEN_SOURCE, "g"),
  render(match, key) {
    try {
      const payload = linkedBadgePayloadSchema.parse(JSON.parse(match[1] ?? "{}"));
      return <LinkedBadge key={key} {...payload} />;
    } catch {
      return <span key={key}>{match[0]}</span>;
    }
  },
};
