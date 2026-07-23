import tw from "@styled-cva/react";

export const ReaderLayout = tw.section(
  "grid h-full grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto_var(--notes-col-width,280px)] overflow-hidden",
);

export const ReaderPanel = tw.aside(
  "min-w-0 overflow-auto border-[var(--color-border)] border-r bg-[var(--color-background-surface)]",
);

export const ReaderMain = tw.main(
  "relative min-w-0 overflow-auto border-[var(--color-border)] border-r bg-[var(--reader-well-bg)]",
);

export const ReaderNotesAside = tw.aside(
  "min-w-0 overflow-auto border-[var(--color-border)] border-l bg-[var(--color-background-surface)] transition-[box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] data-[pending=true]:shadow-[inset_3px_0_0_0_var(--color-text-accent)]",
);

export const ReaderContent = tw.div`mx-auto w-full max-w-[820px]`;

export const ReaderSheet = tw.article(
  // No overflow clip here: it would become the sticky context for
  // ReaderDocumentChrome, which must stick to ReaderMain's scroll instead.
  "min-h-full rounded-none border border-(--color-border) bg-(--reader-paper-bg) shadow-(--shadow-low) transition-[box-shadow] duration-(--duration-fast) ease-(--ease-standard) hover:shadow-(--shadow-med)",
);

export const ReaderDocumentChrome = tw.header(
  "sticky top-0 z-10 border-[var(--color-border)] border-b bg-[var(--reader-chrome-bg)] px-8 py-4 backdrop-blur-sm",
);

export const ReaderDocumentBody = tw.div`px-8 pt-6 pb-14`;

export const ReaderChromeControls = tw.div`mx-auto flex w-fit items-center justify-center gap-2`;

export const ReaderChromeEnd = tw.div("absolute right-8 top-1/2 -translate-y-1/2");

export const ReaderBadgeRow = tw.div`flex flex-wrap items-center gap-1.5`;

export const EmptyState = tw.div(
  "grid h-full place-items-center content-center gap-4 p-6 text-center text-[var(--color-text-secondary)]",
);

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

export const TabStripRow = tw.div(
  "flex min-w-0 items-stretch gap-1 overflow-x-auto border-(--color-border) border-b bg-(--color-background-surface) px-2",
);

export const TabStripItem = tw.button(
  "group flex min-w-0 max-w-[200px] cursor-pointer items-center gap-2 rounded-t-(--radius-inner) border border-transparent border-b-0 px-3 py-2 text-(--color-text-secondary) text-sm transition-[background-color,color] duration-(--duration-fast) ease-(--ease-standard) hover:bg-(--color-background-muted) hover:text-(--color-text-primary)",
  {
    variants: {
      $active: {
        true: "bg-(--reader-well-bg) text-(--color-text-primary)",
        false: "",
      },
    },
    defaultVariants: {
      $active: false,
    },
  },
);

export const TabStripLabel = tw.span`min-w-0 flex-1 truncate text-left`;

export const TabStripDirtyDot = tw.span`size-1.5 shrink-0 rounded-full bg-(--color-text-accent)`;

export const TabStripCloseButton = tw.span(
  "grid shrink-0 place-items-center rounded-(--radius-inner) p-0.5 opacity-0 transition-opacity duration-(--duration-fast) ease-(--ease-standard) group-hover:opacity-100 hover:bg-(--color-background-muted)",
);
