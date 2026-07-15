import tw from "@styled-cva/react";

export const ReaderLayout = tw.section`grid h-full grid-cols-[200px_minmax(0,1fr)_280px] overflow-hidden`;

export const ReaderPanel = tw.aside(
  "overflow-auto border-[var(--color-border)] border-r bg-[var(--color-background-surface)]",
);

export const ReaderMain = tw.main(
  "relative overflow-auto border-[var(--color-border)] border-r bg-[var(--reader-well-bg)]",
);

export const ReaderNotesAside = tw.aside(
  "overflow-auto border-[var(--color-border)] border-l bg-[var(--color-background-surface)] transition-[box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] data-[pending=true]:shadow-[inset_3px_0_0_0_var(--color-text-accent)]",
);

export const ReaderContent = tw.div`mx-auto w-full max-w-[820px] px-6 py-6`;

export const ReaderSheet = tw.article(
  "min-h-full overflow-hidden rounded-[var(--radius-container)] border border-[var(--color-border)] bg-[var(--reader-paper-bg)] shadow-[var(--shadow-low)] transition-[box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:shadow-[var(--shadow-med)]",
);

export const ReaderDocumentChrome = tw.header(
  "sticky top-0 z-10 border-[var(--color-border)] border-b bg-[var(--reader-chrome-bg)] px-8 py-4 backdrop-blur-sm",
);

export const ReaderDocumentBody = tw.div`px-8 pt-6 pb-14`;

export const ReaderChromeControls = tw.div`mx-auto flex w-fit justify-center`;

export const ReaderBadgeRow = tw.div`flex flex-wrap items-center gap-1.5`;

export const EmptyState = tw.div(
  "grid h-full place-items-center content-center gap-4 p-6 text-center text-[var(--color-text-secondary)]",
);

export const PanelStack = tw.div`grid gap-3 p-4`;

export const ButtonRow = tw.div`flex flex-wrap gap-2`;

export const NoteCard = tw.div(
  "mb-3 rounded-[var(--radius-container)] border border-[var(--color-border)] p-3 transition-[opacity,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
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

export const ReplyStack = tw.div`mt-2 grid gap-2`;

export const ReplyBubble = tw.div`rounded-[var(--radius-inner)] bg-[var(--color-background-muted)] p-2`;

export const ReplyBody = tw.div`whitespace-pre-wrap break-words text-[var(--color-text-primary)]`;

export const NoteAnchorButton = tw.button(
  "m-0 max-w-[14rem] cursor-pointer truncate border-none bg-transparent p-0 text-left font-semibold text-[var(--color-text-primary)] underline-offset-2 transition-[color,transform] duration-[var(--duration-fast-min)] ease-[var(--ease-standard)] hover:translate-x-px hover:underline",
);

export const ReplyAuthor = tw.div`mb-1 text-[var(--color-text-secondary)] text-xs`;

export const TocNav = tw.nav`p-3`;

export const MermaidBlock = tw.div(
  "overflow-auto rounded-[var(--radius-container)] border border-[var(--color-border)] p-4",
);
