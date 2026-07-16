import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Markdown, type MarkdownComponents } from "@astryxdesign/core/Markdown";
import { DANGEROUS_URL_PATTERN, type ImageSrcResolver } from "./assets.ts";
import { BadgeRow, linkedBadgePlugin, parseBadgeBlock } from "./badges.tsx";
import { createInlineHtmlPlugins } from "./inline-html.tsx";
import { inlineMathPlugin, MathBlock } from "./math.tsx";
import { MermaidChart } from "./mermaid.tsx";
import { preprocessReaderMarkdown } from "./preprocess.ts";

export type BlockAlign = "center" | "left" | "right";

export type AlignPayload = { align: BlockAlign; body: string };

/** Decode the JSON payload convertAlignWrappers put inside the fence. */
export function decodeAlignPayload(code: string): AlignPayload | null {
  try {
    const parsed = JSON.parse(code.trim()) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const { align, body } = parsed as { align?: unknown; body?: unknown };
    if (align !== "center" && align !== "left" && align !== "right") return null;
    if (typeof body !== "string") return null;
    return { align, body };
  } catch {
    return null;
  }
}

// Blocks inside an align wrapper render without pin buttons or block ids —
// the wrapper is hero chrome, not annotatable prose. Special fences still
// need their custom renderers.
const createNestedComponents = (
  resolveImageSrc: ImageSrcResolver | undefined,
): Partial<MarkdownComponents> => ({
  code({ code, language }) {
    switch (language) {
      case "mermaid":
        return <MermaidChart chart={code} />;
      case "math":
        return <MathBlock tex={code} />;
      case "badges": {
        const badges = parseBadgeBlock(code);
        if (badges) return <BadgeRow badges={badges} />;
        break;
      }
    }
    return <CodeBlock code={code} language={language} isCollapsible />;
  },
  image({ src, alt }) {
    if (DANGEROUS_URL_PATTERN.test(src.trim())) {
      return <span>{alt}</span>;
    }
    return (
      <img
        alt={alt}
        className="reader-inline-img"
        loading="lazy"
        src={resolveImageSrc ? resolveImageSrc(src) : src}
      />
    );
  },
});

export function AlignBlock({
  code,
  resolveImageSrc,
}: {
  code: string;
  resolveImageSrc?: ImageSrcResolver;
}) {
  const payload = decodeAlignPayload(code);

  return payload === null ? (
    <CodeBlock code={code} language="text" />
  ) : (
    <div className="reader-align-block" data-align={payload.align}>
      <Markdown
        autolink="gfm"
        components={createNestedComponents(resolveImageSrc)}
        contentWidth="100%"
        inlinePlugins={[
          linkedBadgePlugin,
          inlineMathPlugin,
          ...createInlineHtmlPlugins(resolveImageSrc),
        ]}
      >
        {preprocessReaderMarkdown(payload.body)}
      </Markdown>
    </div>
  );
}
