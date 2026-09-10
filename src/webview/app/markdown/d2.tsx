import { useEffect, useState } from "react";
import { useColorScheme } from "../theme/ColorSchemeContext.tsx";
import type { ColorScheme } from "../theme/color-scheme-container.ts";
import { DiagramViewer } from "./diagram-viewer.tsx";

/**
 * d2 ships numbered palettes rather than variables, so the reader's own tokens
 * cannot be handed over the way mermaid's can. The closest is picking the
 * palette that matches the scheme in force — and picking again when it changes.
 *
 * Naming both at once, as this used to, makes d2 emit one SVG carrying both and
 * switch between them on `prefers-color-scheme`: the diagram then follows the
 * operating system while the page around it follows the reader.
 */
const D2_THEME_ID: Record<ColorScheme, number> = { light: 0, dark: 200 };

type D2ChartProps = { chart: string };

export function D2Chart({ chart }: D2ChartProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    setErrorMessage(null);

    void (async () => {
      try {
        const { D2 } = await import("@terrastruct/d2");
        const d2 = new D2();
        const { diagram, renderOptions } = await d2.compile(chart);
        // After the spread, not before it: `compile` returns a `themeID` of its
        // own, so naming it first only to have it overwritten is how the theme
        // came to be whatever d2 felt like. Both ids get the same palette, so
        // no branch inside d2 can reach for the other one.
        const svg = await d2.render(diagram, {
          ...renderOptions,
          themeID: D2_THEME_ID[colorScheme],
          darkThemeID: D2_THEME_ID[colorScheme],
        });
        if (!cancelled) {
          setSvgContent(svg);
          setState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setSvgContent(null);
          setErrorMessage(error instanceof Error ? error.message : "Diagram failed to render");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // The drawing already on screen stays up while the next one is prepared;
    // clearing it first would blank every diagram on the way through a toggle.
  }, [chart, colorScheme]);

  return (
    <DiagramViewer
      state={state}
      svgContent={svgContent}
      errorMessage={errorMessage}
      label="D2 Diagram"
    />
  );
}
