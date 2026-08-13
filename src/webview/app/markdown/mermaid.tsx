import { useEffect, useState } from "react";
import { DiagramViewer } from "./diagram-viewer.tsx";

function mermaidTheme(): "dark" | "neutral" {
  if (typeof document === "undefined") return "neutral";
  const mode = document.documentElement.getAttribute("data-theme");
  if (mode === "dark") return "dark";
  if (mode === "light") return "neutral";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "neutral";
}

type MermaidChartProps = { chart: string };

export function MermaidChart({ chart }: MermaidChartProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setErrorMessage(null);
    setSvgContent(null);

    void (async () => {
      const id = `mermaid-${crypto.randomUUID()}`;
      // Mermaid mounts a scratch element for measurement; give it an offscreen host we own
      // so a throwing render cannot leave orphans parented to <body>.
      const host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.style.cssText =
        "position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;pointer-events:none";
      document.body.appendChild(host);

      try {
        const mermaid = await import("mermaid");
        mermaid.default.initialize({ startOnLoad: false, theme: mermaidTheme() });
        // parse() turns syntax errors into a clean rejection before any DOM is created
        await mermaid.default.parse(chart);
        const result = await mermaid.default.render(id, chart, host);
        if (!cancelled) {
          setSvgContent(result.svg);
          setState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setErrorMessage(error instanceof Error ? error.message : "Diagram failed to render");
        }
      } finally {
        host.remove();
        document.getElementById(id)?.remove();
        document.getElementById(`d${id}`)?.remove();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <DiagramViewer
      state={state}
      svgContent={svgContent}
      errorMessage={errorMessage}
      label="Mermaid Diagram"
    />
  );
}
