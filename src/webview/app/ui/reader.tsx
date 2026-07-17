import tw from "@styled-cva/react";

export const ReaderArticle = tw.article`reader-prose w-full min-w-0`;

const headingTypography =
  "scroll-mt-20 font-[family-name:var(--font-family-heading)] text-[var(--color-text-primary)]";

export const ReaderH1 = tw.h1(
  `${headingTypography} text-[length:var(--font-size-2xl)] font-semibold leading-[1.33]`,
);

export const ReaderH2 = tw.h2(
  `${headingTypography} text-[length:var(--font-size-xl)] font-semibold leading-[1.4]`,
);

export const ReaderH3 = tw.h3(
  `${headingTypography} text-[length:var(--font-size-lg)] font-bold leading-[1.41]`,
);

export const ReaderH4 = tw.h4(
  `${headingTypography} text-[length:var(--font-size-base)] font-bold leading-[1.43]`,
);

export const ReaderH5 = tw.h5(
  `${headingTypography} text-[length:var(--font-size-sm)] font-semibold leading-[1.67]`,
);

export const ReaderH6 = tw.h6(
  `${headingTypography} text-[length:var(--font-size-xs)] font-semibold leading-[1.6]`,
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
  "text-[length:var(--text-body-size)] leading-[var(--text-body-leading)] text-[var(--color-text-primary)]",
);

export const ReaderCodeWrap = tw.div`min-w-0`;

export const ReaderBlockquote = tw.blockquote(
  "reader-blockquote border-[var(--color-border-emphasized)] border-l-2 border-solid pl-4 text-[var(--color-text-secondary)]",
);

export const ReaderRaw = tw.div`w-full min-w-0`;

export const ReaderEditor = tw.div(
  "w-full min-w-0 font-[family-name:var(--font-family-code)] [&_textarea]:min-h-[60vh]",
);
