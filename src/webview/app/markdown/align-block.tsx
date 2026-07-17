import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Markdown, type MarkdownComponents } from "@astryxdesign/core/Markdown";
import type { ImageSrcResolver } from "./assets.ts";
import { createReaderInlinePlugins, ReaderImage, renderSpecialFence } from "./pipeline.tsx";
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
// need their custom renderers, except `align` itself: nested align fences
// render as plain code rather than recursing into AlignBlock.
const createNestedComponents = (
  resolveImageSrc: ImageSrcResolver | undefined,
): Partial<MarkdownComponents> => ({
  code({ code, language }) {
    return (
      renderSpecialFence(language, code, { resolveImageSrc }, { skip: ["align"] }) ?? (
        <CodeBlock code={code} language={language} isCollapsible />
      )
    );
  },
  image({ src, alt }) {
    return <ReaderImage src={src} alt={alt} resolveImageSrc={resolveImageSrc} />;
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
        inlinePlugins={createReaderInlinePlugins(resolveImageSrc)}
      >
        {preprocessReaderMarkdown(payload.body)}
      </Markdown>
    </div>
  );
}
