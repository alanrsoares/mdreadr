import { useEffect, useState } from "react";
import { useColorScheme } from "../theme/ColorSchemeContext.tsx";
import { mermaidThemeVariables, readDiagramPalette } from "./diagram-palette.ts";
import { DiagramViewer } from "./diagram-viewer.tsx";
import { takeRenderTurn } from "./render-turns.ts";

type MermaidChartProps = { chart: string };

export function MermaidChart({ chart }: MermaidChartProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  // The reader's own scheme, not the OS preference and not an attribute read
  // off the document: this is the value the rest of the page is painted from,
  // and a diagram drawn from anything else is drawn from a second opinion.
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    setErrorMessage(null);

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
        // Configuring and rendering are one turn: the configuration is global,
        // so anything that gets between them renders this diagram in someone
        // else's palette.
        const result = await takeRenderTurn(async () => {
          // A superseded effect must not write the configuration on its way
          // out: the import it was waiting on can resolve after the scheme has
          // already moved on.
          if (cancelled) return undefined;

          mermaid.default.initialize({
            startOnLoad: false,
            // `base` derives its colours from what it is given; every other
            // theme brings its own, which is the pair of palettes this used to
            // have.
            theme: "base",
            themeVariables: mermaidThemeVariables(readDiagramPalette(host, colorScheme)),
            // The diagram's own frontmatter is applied after this, and would
            // otherwise be free to name a theme of its own — a document could
            // hand itself colours the reader's page never agreed to.
            secure: ["theme", "themeVariables"],
          });
          // parse() turns syntax errors into a clean rejection before any DOM
          // is created
          await mermaid.default.parse(chart);
          return mermaid.default.render(id, chart, host);
        });

        if (!cancelled && result) {
          setSvgContent(result.svg);
          setState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setSvgContent(null);
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
    // A scheme change re-renders the diagram: mermaid bakes the colours into
    // the SVG, so there is nothing to restyle afterwards. The drawing already
    // on screen stays up while the next one is prepared — clearing it first
    // would blank every diagram on the page on the way through the toggle.
  }, [chart, colorScheme]);

  return (
    <DiagramViewer
      state={state}
      svgContent={svgContent}
      errorMessage={errorMessage}
      label="Mermaid Diagram"
    />
  );
}
