import { useEffect, useRef } from "react";
import { MermaidBlock as MermaidFrame } from "../ui/layout.tsx";

export function MermaidChart({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    void (async () => {
      const mermaid = await import("mermaid");
      mermaid.default.initialize({ startOnLoad: false, theme: "neutral" });
      const id = `mermaid-${crypto.randomUUID()}`;
      const result = await mermaid.default.render(id, chart);
      if (!cancelled) {
        container.innerHTML = result.svg;
      }
    })();

    return () => {
      cancelled = true;
      container.innerHTML = "";
    };
  }, [chart]);

  return <MermaidFrame ref={containerRef} />;
}
