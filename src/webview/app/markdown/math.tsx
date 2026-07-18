import type { MarkdownInlinePlugin } from "@astryxdesign/core/Markdown";
import katex from "katex";
import { useEffect, useRef } from "react";

type MathProps = { tex: string };

export function MathBlock({ tex }: MathProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    katex.render(tex, container, {
      displayMode: true,
      throwOnError: false,
    });
  }, [tex]);

  return <div ref={containerRef} className="reader-math-block" />;
}

function InlineMath({ tex }: MathProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    katex.render(tex, container, {
      displayMode: false,
      throwOnError: false,
    });
  }, [tex]);

  return <span ref={containerRef} className="reader-math-inline" />;
}

export const inlineMathPlugin: MarkdownInlinePlugin = {
  pattern: /\$([^$\n]+?)\$/g,
  render(match, key) {
    return <InlineMath key={key} tex={match[1] ?? ""} />;
  },
};
