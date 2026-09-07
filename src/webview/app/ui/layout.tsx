import tw from "@styled-cva/react";

export const ReaderContent = tw.div("relative inset-0 h-full min-h-full w-full overscroll-none");

export const ReaderSheet = tw.article(
  // No overflow clip here: it would become the sticky context for
  // ReaderDocumentChrome, which must stick to ReaderMain's scroll instead.
  // No `h-full` either: pinning the sheet to one viewport left its sticky
  // header with a 100%-tall containing block, so the chrome scrolled away with
  // the first screenful. `min-h-full` keeps a short document filling the pane
  // while a long one grows the sheet, which is what keeps the header up.
  "flex min-h-full flex-col rounded-none border-0 bg-(--reader-paper-bg) overscroll-none",
);

export const ReaderDocumentChrome = tw.header(
  "sticky top-0 z-10 shrink-0 border-[var(--color-border)] border-b bg-[var(--reader-chrome-bg)] px-4 py-3.5 backdrop-blur-sm sm:px-6 md:px-8",
);

export const ReaderChromeControls = tw.div`mx-auto flex w-fit items-center justify-center gap-2`;

export const ReaderChromeEnd = tw.div(
  "absolute right-4 top-1/2 -translate-y-1/2 sm:right-2 md:right-3.5",
);

export const ReaderDocumentBody = tw.div`min-h-0 flex-1`;

// The one column both modes live in. Preview and Edit share it so that toggling
// leaves the text where it was: same centring, same padding, same width. Sheet
// width is chrome, but it must never be the thing that sets line length - past
// ~24px reader text the 920px cap would clip the measure, so the column grows
// to fit the measure plus its own widest padding.
export const ReaderColumn = tw.div(
  "mx-auto max-w-[min(100%,max(clamp(640px,68vw,920px),calc(var(--reader-measure)+7rem)))] px-8 pt-4 pb-12 sm:px-10 sm:pt-6 sm:pb-14 md:px-14",
);

export const ReaderBadgeRow = tw.div`flex flex-wrap items-center gap-1.5`;

export const PanelStack = tw.div`grid gap-3 p-4`;

export const ButtonRow = tw.div`flex flex-wrap gap-2`;

export const NoteCard = tw.div(
  "mb-3 rounded-(--radius-container) border border-(--color-border) p-3 transition-[opacity,border-color,box-shadow] duration-(--duration-fast) ease-(--ease-standard)",
  {
    variants: {
      $status: {
        open: "",
        resolved: "opacity-75",
        wontfix: "opacity-75",
      },
    },
    defaultVariants: {
      $status: "open",
    },
  },
);

export const NoteCardHeader = tw.div`flex items-center justify-between gap-2`;

export const NoteKindBadge = tw.span(
  "rounded-(--radius-inner) bg-(--color-background-muted) px-1.5 py-0.5 text-(--color-text-secondary) text-xs",
);

export const MutedText = tw.p`m-0 text-(--color-text-secondary)`;

export const NoteMeta = tw.p`my-2 text-(--color-text-secondary)`;

export const ReplyList = tw.div`mt-2 grid gap-2`;

export const ReplyStack = tw.div`mt-2 grid gap-2`;

export const ReplyBubble = tw.div`rounded-(--radius-inner) bg-(--color-background-muted) p-2`;

export const ReplyBody = tw.div`whitespace-pre-wrap break-words text-(--color-text-primary)`;

export const NoteAnchorButton = tw.button(
  "m-0 max-w-[14rem] cursor-pointer truncate border-none bg-transparent p-0 text-left font-semibold text-(--color-text-primary) underline-offset-2 transition-[color,transform] duration-(--duration-fast-min) ease-(--ease-standard) hover:translate-x-px hover:underline",
);

export const ReplyAuthor = tw.div`mb-1 text-(--color-text-secondary) text-xs`;

export const TocNav = tw.nav`p-3`;

export const MermaidBlock = tw.div(
  "overflow-auto rounded-(--radius-container) border border-(--color-border) p-4",
);

export const TabStripDirtyDot = tw.span`size-1.5 shrink-0 rounded-full bg-(--color-text-accent)`;

export const TabStripCloseButton = tw.span(
  "grid shrink-0 place-items-center rounded-(--radius-inner) p-0.5 opacity-0 transition-opacity duration-(--duration-fast) ease-(--ease-standard) group-hover:opacity-100 hover:bg-(--color-background-muted)",
);
