import tw from "@styled-cva/react";

export const ReaderArticle = tw.article`reader-prose w-full min-w-0 font-[family-name:var(--reader-prose-family)]`;

const headingTypography =
  "scroll-mt-20 font-[family-name:var(--font-family-heading)] text-[var(--color-text-primary)]";

export const ReaderH1 = tw.h1(`${headingTypography} text-[2.125em] font-semibold leading-[1.25]`);

export const ReaderH2 = tw.h2(`${headingTypography} text-[1.625em] font-semibold leading-[1.3]`);

export const ReaderH3 = tw.h3(`${headingTypography} text-[1.35em] font-bold leading-[1.35]`);

export const ReaderH4 = tw.h4(`${headingTypography} text-[1.15em] font-bold leading-[1.4]`);

// h5/h6 stop shrinking at body size — below that they read as smaller than the
// prose they introduce. Rank comes from case, colour, and tracking instead.
const deepHeadingTypography =
  "scroll-mt-20 font-[family-name:var(--font-family-heading)] text-[1em] uppercase leading-[1.5] tracking-[0.07em]";

export const ReaderH5 = tw.h5(
  `${deepHeadingTypography} font-semibold text-[var(--color-text-primary)]`,
);

export const ReaderH6 = tw.h6(
  `${deepHeadingTypography} font-medium text-[var(--color-text-secondary)]`,
);

export const readerHeadingByLevel = {
  1: ReaderH1,
  2: ReaderH2,
  3: ReaderH3,
  4: ReaderH4,
  5: ReaderH5,
  6: ReaderH6,
} as const;

export const ReaderParagraph = tw.div(
  "max-w-[68ch] font-[family-name:var(--reader-prose-family)] text-[length:var(--text-body-size)] leading-[var(--text-body-leading)] text-[var(--color-text-primary)]",
);

export const ReaderCodeWrap = tw.div`min-w-0`;

export const ReaderBlockquote = tw.blockquote(
  "reader-blockquote border-[var(--color-border-emphasized)] border-l-2 border-solid pl-4 text-[var(--color-text-secondary)]",
);

export const ReaderRaw = tw.div`w-full min-w-0`;

export const ReaderEditor = tw.div(
  "flex h-full min-h-0 w-full min-w-0 flex-col font-[family-name:var(--font-family-code)] [&_.cm-editor]:h-full [&_.cm-theme]:h-full",
);
