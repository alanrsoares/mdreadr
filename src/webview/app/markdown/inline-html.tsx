import type { MarkdownInlinePlugin } from "@astryxdesign/core/Markdown";
import { DANGEROUS_URL_PATTERN, type ImageSrcResolver } from "./assets.ts";

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
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
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

function createImgPlugin(resolveImageSrc?: ImageSrcResolver): MarkdownInlinePlugin {
  return {
    pattern: IMG_PATTERN,
    render(match, key) {
      const parsed = parseImgTag(match[1] ?? "");
      if (!parsed) {
        return <span key={key}>{match[0]}</span>;
      }
      return (
        <img
          alt={parsed.alt}
          className="reader-inline-img"
          height={parsed.height}
          key={key}
          loading="lazy"
          src={resolveImageSrc ? resolveImageSrc(parsed.src) : parsed.src}
          width={parsed.width}
        />
      );
    },
  };
}

export function createInlineHtmlPlugins(
  resolveImageSrc?: ImageSrcResolver,
): MarkdownInlinePlugin[] {
  return [kbdPlugin, supPlugin, subPlugin, brPlugin, createImgPlugin(resolveImageSrc)];
}
