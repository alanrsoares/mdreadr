import { defineTheme, type TokenName, type TokenValue } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

/** Reader-specific tokens layered on neutral. Cast: Astryx TokenName is core-only. */
const readerTokens = {
  "--reader-well-bg": ["#e8e4de", "#11100f"],
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
