import { describe, expect, it } from "bun:test";
import { prepareModalSvg } from "./diagram-viewer.tsx";

describe("prepareModalSvg", () => {
  it("safely handles server / non-DOM environments", () => {
    expect(() => prepareModalSvg({} as HTMLElement)).not.toThrow();
  });

  it("updates SVG attributes and styles on a mock element", () => {
    const styles: Record<string, string> = {};
    const attrs: Record<string, string> = { width: "800", height: "600" };
    const mockSvg = {
      getAttribute: (k: string) => attrs[k] ?? null,
      setAttribute: (k: string, v: string) => {
        attrs[k] = v;
      },
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
      style: styles,
    };
    const mockContainer = {
      querySelector: (selector: string) => (selector === "svg" ? mockSvg : null),
    } as unknown as HTMLElement;

    prepareModalSvg(mockContainer);

    expect(attrs.viewBox).toBe("0 0 800 600");
    expect(styles.maxWidth).toBe("100%");
    expect(styles.maxHeight).toBe("100%");
    expect(styles.width).toBe("100%");
    expect(styles.height).toBe("100%");
  });
});
