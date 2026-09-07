import { defineTheme, type TokenName, type TokenValue } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

/** Reader-specific tokens layered on neutral. Cast: Astryx TokenName is core-only. */
const readerTokens = {
  // Neutral ships a near-white placeholder accent; mdreadr owns the logo blue (#36A9E1).
  "--color-accent": ["#1c7ea8", "#5ebae7"],
  // Neutral's dark body text is pure #fff; the paper is warm, so tint it to
  // match (DESIGN §1: no pure black or white on either sheet).
  "--color-text-primary": ["#111111", "#f2ede6"],
  "--color-text-accent": ["#166b8f", "#7ecbef"],
  "--reader-well-bg": ["#faf8f5", "#1c1a18"],
  "--reader-paper-bg": ["#faf8f5", "#1c1a18"],
  "--reader-chrome-bg": ["rgb(250 248 245 / 0.92)", "rgb(28 26 24 / 0.92)"],
  "--reader-prose-family":
    '"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
} satisfies Record<string, TokenValue>;

export const mdreadrTheme = defineTheme({
  name: "mdreadr",
  extends: neutralTheme,
  tokens: readerTokens as Partial<Record<TokenName, TokenValue>>,
});
