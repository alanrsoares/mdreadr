import type { MarkdownInlinePlugin } from "@astryxdesign/core/Markdown";
import type { ReactNode } from "react";
import { AlignBlock } from "./align-block.tsx";
import { DANGEROUS_URL_PATTERN, type ImageSrcResolver } from "./assets.ts";
import { BadgeRow, linkedBadgePlugin, parseBadgeBlock } from "./badges.tsx";
import { createInlineHtmlPlugins } from "./inline-html.tsx";
import { inlineMathPlugin, MathBlock } from "./math.tsx";
import { MermaidChart } from "./mermaid.tsx";

export { createAssetResolver } from "./assets.ts";
export { preprocessReaderMarkdown } from "./preprocess.ts";
export type { ImageSrcResolver };

type SpecialFenceContext = { resolveImageSrc?: ImageSrcResolver };
type SpecialFenceRenderer = (code: string, ctx: SpecialFenceContext) => ReactNode | null;
type RenderSpecialFenceOptions = { skip?: readonly string[] };

// Registration order/list is the single source of truth for "special".
const SPECIAL_FENCES: Record<string, SpecialFenceRenderer> = {
  align: (code, ctx) => <AlignBlock code={code} resolveImageSrc={ctx.resolveImageSrc} />,
  mermaid: (code) => <MermaidChart chart={code} />,
  math: (code) => <MathBlock tex={code} />,
  badges: (code) => {
    const badges = parseBadgeBlock(code);
    return badges ? <BadgeRow badges={badges} /> : null;
  },
};

/** Fence languages with dedicated renderers (align, mermaid, math, badges). */
export const isSpecialFence = (language: string | undefined): boolean =>
  language != null && language in SPECIAL_FENCES;

/** Render a special fence, or null when `language` is not special / payload invalid. */
export function renderSpecialFence(
  language: string | undefined,
  code: string,
  ctx: SpecialFenceContext,
  // Internal-only: fence languages to treat as not-special. Used by the
  // align-block nested renderer so an `align` fence nested inside another
  // align body renders as plain code instead of recursing into AlignBlock.
  options?: RenderSpecialFenceOptions,
): ReactNode | null {
  if (language == null || options?.skip?.includes(language)) return null;
  const renderer = SPECIAL_FENCES[language];
  return renderer ? renderer(code, ctx) : null;
}

type ReaderImageProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  resolveImageSrc?: ImageSrcResolver;
};

/** Single sanitize+resolve image renderer used by block, inline-HTML, and nested renderers. */
export function ReaderImage({
  src,
  alt,
  width,
  height,
  resolveImageSrc,
}: ReaderImageProps): ReactNode {
  if (DANGEROUS_URL_PATTERN.test(src.trim())) {
    return <span>{alt}</span>;
  }
  return (
    <img
      alt={alt}
      className="reader-inline-img"
      loading="lazy"
      src={resolveImageSrc ? resolveImageSrc(src) : src}
      width={width}
      height={height}
    />
  );
}

/** All reader inline plugins (linked badges, inline math, inline HTML) in canonical order. */
export const createReaderInlinePlugins = (
  resolveImageSrc?: ImageSrcResolver,
): MarkdownInlinePlugin[] => [
  linkedBadgePlugin,
  inlineMathPlugin,
  ...createInlineHtmlPlugins(resolveImageSrc),
];
