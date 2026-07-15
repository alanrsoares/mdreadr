import tw from "@styled-cva/react";

export const ReaderLayout = tw.section`grid h-full grid-cols-[240px_minmax(0,1fr)_320px] overflow-hidden`;

export const ReaderPanel = tw.aside`overflow-auto border-[var(--color-border)] border-r`;

export const ReaderMain = tw.main`overflow-auto border-[var(--color-border)] border-r`;

export const ReaderNotesAside = tw.aside`overflow-auto border-[var(--color-border)] border-l`;

export const ReaderContent = tw.div`mx-auto w-full max-w-[760px] px-10 pt-8 pb-16`;

export const ReaderToolbar = tw.div`mx-auto mb-6 w-full max-w-xs`;

export const ReaderBadgeRow = tw.div`flex flex-wrap items-center gap-1.5`;

export const EmptyState = tw.div(
  "grid h-full place-items-center p-6 text-center text-[var(--color-text-secondary)]",
);

export const TopNavActions = tw.div`ml-auto flex gap-2`;

export const PanelStack = tw.div`grid gap-3 p-4`;

export const ButtonRow = tw.div`flex flex-wrap gap-2`;

export const NoteCard = tw.div(
  "mb-3 rounded-[var(--radius-container)] border border-[var(--color-border)] p-3",
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

export const MutedText = tw.p`m-0 text-[var(--color-text-secondary)]`;

export const NoteMeta = tw.p`my-2 text-[var(--color-text-secondary)]`;

export const ReplyList = tw.div`mt-2 grid gap-2`;

export const ReplyBubble = tw.div`rounded-[var(--radius-inner)] bg-[var(--color-background-surface)] p-2`;

export const ReplyAuthor = tw.div`mb-1 text-[var(--color-text-secondary)] text-xs`;

export const TocNav = tw.nav`p-4`;

export const TocLink = tw.a(
  "block cursor-pointer py-1 text-[var(--color-text-secondary)] no-underline",
  {
    variants: {
      $active: {
        true: "font-semibold text-[var(--color-text-primary)]",
        false: "hover:text-[var(--color-text-primary)]",
      },
    },
    defaultVariants: {
      $active: false,
    },
  },
);

export const MermaidBlock = tw.div(
  "overflow-auto rounded-[var(--radius-container)] border border-[var(--color-border)] p-4",
);
