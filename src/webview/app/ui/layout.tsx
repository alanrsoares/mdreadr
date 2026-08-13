import tw from "@styled-cva/react";

// The horizontal padding is what makes --reader-well-bg (and the sheet's border,
// radius and shadow) visible: without it the sheet fills the well edge to edge
// at every window size this app is actually used at.
export const ReaderContent = tw.div(
  "mx-auto min-h-full w-full max-w-[min(100%,clamp(640px,68vw,920px))] px-3 py-3 sm:px-5 sm:py-5",
);

export const ReaderSheet = tw.article(
  // No overflow clip here: it would become the sticky context for
  // ReaderDocumentChrome, which must stick to ReaderMain's scroll instead.
  "flex min-h-full flex-col rounded-none border border-(--color-border) bg-(--reader-paper-bg) shadow-(--shadow-low) transition-[box-shadow] duration-(--duration-fast) ease-(--ease-standard) hover:shadow-(--shadow-med)",
);

export const ReaderDocumentChrome = tw.header(
  "sticky top-0 z-10 shrink-0 border-[var(--color-border)] border-b bg-[var(--reader-chrome-bg)] px-4 py-3.5 backdrop-blur-sm sm:px-6 md:px-8",
);

export const ReaderChromeControls = tw.div`mx-auto flex w-fit items-center justify-center gap-2`;

export const ReaderChromeEnd = tw.div(
  "absolute right-4 top-1/2 -translate-y-1/2 sm:right-2 md:right-3.5",
);

// Padding is owned by the mode-specific wrapper inside DocumentView (preview
// needs it, the editor supplies its own), so this stays a bare flex child.
export const ReaderDocumentBody = tw.div`min-h-0 flex-1`;

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
