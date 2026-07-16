import type { MarkdownInlinePlugin } from "@astryxdesign/core/Markdown";
import { ReaderBadgeRow } from "../ui/layout.tsx";

export const LINKED_BADGE_PATTERN = /\[\[\[BADGE:(\{.*?\})\]\]\]/g;

export type LinkedBadgePayload = {
  alt: string;
  src: string;
  href: string;
};

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

export const BadgeRow = ({ badges }: { badges: LinkedBadgePayload[] }) => (
  <ReaderBadgeRow>
    {badges.map((badge) => (
      <LinkedBadge key={`${badge.href}:${badge.src}`} {...badge} />
    ))}
  </ReaderBadgeRow>
);

export function parseBadgeBlock(code: string): LinkedBadgePayload[] | null {
  try {
    const parsed = JSON.parse(code) as unknown;
    return !Array.isArray(parsed)
      ? null
      : parsed.filter(
          (item): item is LinkedBadgePayload =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as LinkedBadgePayload).alt === "string" &&
            typeof (item as LinkedBadgePayload).src === "string" &&
            typeof (item as LinkedBadgePayload).href === "string",
        );
  } catch {
    return null;
  }
}

/** Fallback for badge tokens left inline inside mixed paragraphs. */
export const linkedBadgePlugin: MarkdownInlinePlugin = {
  pattern: LINKED_BADGE_PATTERN,
  render(match, key) {
    try {
      const payload = JSON.parse(match[1] ?? "{}") as LinkedBadgePayload;
      return <LinkedBadge key={key} {...payload} />;
    } catch {
      return <span key={key}>{match[0]}</span>;
    }
  },
};
