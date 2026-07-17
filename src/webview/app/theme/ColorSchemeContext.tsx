import { Theme } from "@astryxdesign/core/theme";
import { createContext, type ReactNode, useContext, useState } from "react";
import { mdreadrTheme } from "./mdreadr.js";

export type ColorScheme = "light" | "dark" | "system";

interface ColorSchemeContextType {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextType | undefined>(undefined);

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    const saved = localStorage.getItem("mdreadr-color-scheme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "system";
  });

  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    localStorage.setItem("mdreadr-color-scheme", scheme);
  };

  return (
    <ColorSchemeContext.Provider value={{ colorScheme, setColorScheme }}>
      <Theme theme={mdreadrTheme} mode={colorScheme}>
        {children}
      </Theme>
    </ColorSchemeContext.Provider>
  );
}

export function useColorScheme() {
  const context = useContext(ColorSchemeContext);
  if (!context) {
    throw new Error("useColorScheme must be used within a ColorSchemeProvider");
  }
  return context;
}
