import { useEffect, useRef, useState } from "react";
import { MermaidBlock as MermaidFrame } from "../ui/layout.tsx";

function mermaidTheme(): "dark" | "neutral" {
  if (typeof document === "undefined") return "neutral";
  const mode = document.documentElement.getAttribute("data-theme");
  if (mode === "dark") return "dark";
  if (mode === "light") return "neutral";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "neutral";
}

export function MermaidChart({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    setState("loading");
    setErrorMessage(null);
    container.innerHTML = "";

    void (async () => {
      try {
        const mermaid = await import("mermaid");
        mermaid.default.initialize({ startOnLoad: false, theme: mermaidTheme() });
        const id = `mermaid-${crypto.randomUUID()}`;
        const result = await mermaid.default.render(id, chart);
        if (!cancelled) {
          container.innerHTML = result.svg;
          setState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setErrorMessage(error instanceof Error ? error.message : "Diagram failed to render");
        }
      }
    })();

    return () => {
      cancelled = true;
      container.innerHTML = "";
    };
  }, [chart]);

  return (
    <MermaidFrame aria-busy={state === "loading"}>
      {state === "loading" ? (
        <span className="reader-mermaid-status">Rendering diagram…</span>
      ) : null}
      {state === "error" ? (
        <span className="reader-mermaid-status reader-mermaid-status-error" role="alert">
          {errorMessage ?? "Diagram failed to render"}
        </span>
      ) : null}
      <div ref={containerRef} />
    </MermaidFrame>
  );
}
