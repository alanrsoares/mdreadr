import type { MarkdownInlinePlugin } from "@astryxdesign/core/Markdown";
import { DANGEROUS_URL_PATTERN, type ImageSrcResolver } from "./assets.ts";
import { ReaderImage } from "./pipeline.tsx";

// GitHub renders a sanitized subset of inline HTML; the Astryx parser passes
// tags through as literal text, so these plugins pick them up from text nodes.
// Tag bodies must be plain text — markdown inside (e.g. <sup>**x**</sup>)
// splits across parser nodes and won't match, which covers real-world usage
// (keyboard keys, ordinals, footnote-style markers).

export const KBD_PATTERN = /<kbd>([^<>\n]*)<\/kbd>/gi;
export const SUP_PATTERN = /<sup>([^<>\n]*)<\/sup>/gi;
export const SUB_PATTERN = /<sub>([^<>\n]*)<\/sub>/gi;
export const BR_PATTERN = /<br\s*\/?>/gi;
export const IMG_PATTERN = /<img\b([^<>]*?)\/?>/gi;

export function imgAttribute(attrs: string, name: string): string | null {
  const match = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  ).exec(attrs);
  return !match ? null : (match[1] ?? match[2] ?? match[3] ?? null);
}

export function parseImgTag(attrs: string): {
  src: string;
  alt: string;
  width?: number;
  height?: number;
} | null {
  const src = imgAttribute(attrs, "src")?.trim();
  if (!src || DANGEROUS_URL_PATTERN.test(src)) return null;

  const toDimension = (value: string | null): number | undefined => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  return {
    src,
    alt: imgAttribute(attrs, "alt") ?? "",
    width: toDimension(imgAttribute(attrs, "width")),
    height: toDimension(imgAttribute(attrs, "height")),
  };
}

const kbdPlugin: MarkdownInlinePlugin = {
  pattern: KBD_PATTERN,
  render(match, key) {
    return (
      <kbd className="reader-kbd" key={key}>
        {match[1]}
      </kbd>
    );
  },
};

const supPlugin: MarkdownInlinePlugin = {
  pattern: SUP_PATTERN,
  render(match, key) {
    return <sup key={key}>{match[1]}</sup>;
  },
};

const subPlugin: MarkdownInlinePlugin = {
  pattern: SUB_PATTERN,
  render(match, key) {
    return <sub key={key}>{match[1]}</sub>;
  },
};

const brPlugin: MarkdownInlinePlugin = {
  pattern: BR_PATTERN,
  render(_match, key) {
    return <br key={key} />;
  },
};

const createImgPlugin = (resolveImageSrc?: ImageSrcResolver): MarkdownInlinePlugin => ({
  pattern: IMG_PATTERN,
  render(match, key) {
    const parsed = parseImgTag(match[1] ?? "");
    return !parsed ? (
      <span key={key}>{match[0]}</span>
    ) : (
      <ReaderImage
        key={key}
        src={parsed.src}
        alt={parsed.alt}
        width={parsed.width}
        height={parsed.height}
        resolveImageSrc={resolveImageSrc}
      />
    );
  },
});

export const createInlineHtmlPlugins = (
  resolveImageSrc?: ImageSrcResolver,
): MarkdownInlinePlugin[] => [
  kbdPlugin,
  supPlugin,
  subPlugin,
  brPlugin,
  createImgPlugin(resolveImageSrc),
];
