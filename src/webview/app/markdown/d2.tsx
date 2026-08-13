import { useEffect, useState } from "react";
import { DiagramViewer } from "./diagram-viewer.tsx";

const d2Theme = (): { themeID: number; darkThemeID: number } => ({ themeID: 0, darkThemeID: 200 });

type D2ChartProps = { chart: string };

export function D2Chart({ chart }: D2ChartProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setErrorMessage(null);
    setSvgContent(null);

    void (async () => {
      try {
        const { D2 } = await import("@terrastruct/d2");
        const d2 = new D2();
        const { diagram, renderOptions } = await d2.compile(chart);
        const svg = await d2.render(diagram, { ...d2Theme(), ...renderOptions });
        if (!cancelled) {
          setSvgContent(svg);
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
    };
  }, [chart]);

  return (
    <DiagramViewer
      state={state}
      svgContent={svgContent}
      errorMessage={errorMessage}
      label="D2 Diagram"
    />
  );
}
