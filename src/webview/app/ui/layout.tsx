import tw from "@styled-cva/react";

export const ReaderContent = tw.div("relative inset-0 h-full min-h-full w-full overscroll-none");

export const ReaderSheet = tw.article(
  // No overflow clip here: it would become the sticky context for
  // ReaderDocumentChrome, which must stick to ReaderMain's scroll instead.
  // No `h-full` either: pinning the sheet to one viewport left its sticky
  // header with a 100%-tall containing block, so the chrome scrolled away with
  // the first screenful. `min-h-full` keeps a short document filling the pane
  // while a long one grows the sheet, which is what keeps the header up.
  // `relative` is the find bar's containing block; nothing else in the sheet
  // is positioned, so it costs the layout nothing.
  "relative flex min-h-full flex-col rounded-none border-0 bg-(--reader-paper-bg) overscroll-none",
);

export const ReaderDocumentChrome = tw.header(
  "sticky top-0 z-10 shrink-0 border-[var(--color-border)] border-b bg-[var(--reader-chrome-bg)] px-4 py-3.5 backdrop-blur-sm sm:px-6 md:px-8",
);

export const ReaderChromeControls = tw.div`mx-auto flex w-fit items-center justify-center gap-2`;

// Mirrors ReaderChromeEnd on the other side, so the centred mode switch stays
// centred on the sheet rather than being pushed by whatever sits beside it.
export const ReaderChromeStart = tw.div(
  "absolute top-1/2 left-4 -translate-y-1/2 tabular-nums sm:left-2 md:left-3.5",
);

export const ReaderChromeEnd = tw.div(
  "absolute right-4 top-1/2 -translate-y-1/2 sm:right-2 md:right-3.5",
);

export const ReaderDocumentBody = tw.div`min-h-0 flex-1`;

// Floats over the sheet: find must not move the prose it is searching. Sits
// below the sticky chrome's z-index so scrolling never runs the text over it.
// Find takes the chrome row over rather than adding one: an extra row would
// push the prose down the moment the reader opens it, and the chrome's own
// controls are not what they are reaching for while searching.
export const FindBarShell = tw.div(
  "absolute inset-0 z-20 flex items-center justify-end gap-2 bg-(--reader-chrome-bg-solid) px-4 sm:px-6 md:px-8",
);

/** Fixed width so the step buttons hold still as the count changes. */
export const FindCount = tw.span("min-w-12 text-center");

// The one column both modes live in. Preview and Edit share it so that toggling
// leaves the text where it was: same centring, same padding, same width. Sheet
// width is chrome, but it must never be the thing that sets line length - past
// ~24px reader text the 920px cap would clip the measure, so the column grows
// to fit the measure plus its own widest padding.
export const ReaderColumn = tw.div(
  "mx-auto max-w-[min(100%,max(clamp(640px,68vw,920px),calc(var(--reader-measure)+7rem)))] px-8 pt-4 pb-12 sm:px-10 sm:pt-6 sm:pb-14 md:px-14",
);

export const ReaderBadgeRow = tw.div`flex flex-wrap items-center gap-1.5`;

// The review column is a frame, not a scroll of loose cards: the header keeps
// the counts and the filter reachable at any scroll depth, and the disk chores
// sit in the footer because they are the rarest thing in the column.
export const ReviewColumn = tw.div`grid h-full min-h-0 w-full min-w-0 grid-rows-[auto_1fr_auto]`;

export const ReviewHeader = tw.header(
  "grid min-w-0 gap-2 border-(--color-border) border-b px-4 py-2.5",
);

export const ReviewTitleGroup = tw.div`flex min-w-0 items-baseline gap-2`;

export const ReviewBody = tw.div`min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4 py-3`;

export const ReviewStack = tw.div`grid min-w-0 gap-3`;

export const ReviewFooter = tw.footer(
  "flex flex-wrap gap-2 border-(--color-border) border-t px-4 py-2.5",
);

export const ButtonRow = tw.div`flex flex-wrap gap-2`;

export const MutedText = tw.p`m-0 text-(--color-text-secondary)`;

// `group/thread` drives the reveal of the status actions, the same
// hover-or-focus contract the block gutter controls use.
export const ThreadCard = tw.section(
  "group/thread grid min-w-0 gap-2 rounded-(--radius-container) border border-(--color-border) p-3 transition-[opacity,border-color,box-shadow] duration-(--duration-fast) ease-(--ease-standard)",
  {
    variants: {
      $tone: {
        open: "",
        settled: "opacity-70 hover:opacity-100 focus-within:opacity-100",
      },
    },
    defaultVariants: { $tone: "open" },
  },
);

export const ThreadHeader = tw.div`grid min-w-0 gap-1`;

// The anchor label is what the reader scans the column by, so it gets the
// whole width and the badges drop to the meta row underneath it.
export const ThreadMetaRow = tw.div`flex min-w-0 items-center justify-between gap-2`;

// Badges get a row of their own: sharing one with the timestamp and the
// status actions squeezed "Edit request" down to "Edit requ…" at the panel's
// default 280px.
export const ThreadBadges = tw.div`flex flex-wrap items-center gap-1`;

// Invisible at rest, so the column reads as text rather than as a toolbar, but
// always in the tab order: focus-within brings it back for keyboard readers.
export const ThreadActions = tw.div(
  "flex items-center gap-1 opacity-0 transition-opacity duration-(--duration-fast) ease-(--ease-standard) focus-within:opacity-100 group-hover/thread:opacity-100 group-focus-within/thread:opacity-100",
);

export const ThreadMeta = tw.p`m-0 min-w-0 flex-1 truncate text-(--color-text-secondary) text-xs`;

export const MessageList = tw.div`grid min-w-0 gap-2`;

// Provenance without a stripe (DESIGN.md §4): a human turn sits on the muted
// fill the reader already reads as "mine", an agent turn is outlined on the
// panel surface so the two alternate visibly down a long thread.
export const MessageBubble = tw.div("grid min-w-0 gap-1 rounded-(--radius-inner) p-2", {
  variants: {
    $author: {
      human: "bg-(--color-background-muted)",
      agent: "border border-(--color-border) bg-transparent",
      system: "border border-(--color-border) border-dashed bg-transparent",
    },
  },
  defaultVariants: { $author: "human" },
});

export const MessageAuthor = tw.div(
  "flex items-center gap-1 text-(--color-text-secondary) text-xs",
);

export const MessageBody = tw.div`whitespace-pre-wrap break-words text-(--color-text-primary)`;

export const ReplyStack = tw.div`grid gap-2`;

// The proposed replacement is source text, so it is set in the code face: the
// reader is judging an exact splice, not prose.
export const SuggestionCard = tw.div(
  "grid min-w-0 gap-2 rounded-(--radius-inner) border border-(--color-border) p-2",
);

export const SuggestionText = tw.pre(
  "m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-(--color-text-primary) text-xs",
);

export const NoteAnchorButton = tw.button(
  "m-0 line-clamp-2 w-full min-w-0 cursor-pointer border-none bg-transparent p-0 text-left font-semibold text-(--color-text-primary) underline-offset-2 transition-[color,transform] duration-(--duration-fast-min) ease-(--ease-standard) hover:translate-x-px hover:underline",
);

export const RecentItemRow = tw.div`group/recent w-full`;

// Quiet at rest, like the block gutter controls: a column of identical "..."
// glyphs is chrome for its own sake. `has-[[aria-expanded=true]]` keeps the
// trigger visible while its own menu is open, so it cannot fade out from under
// the pointer.
export const RecentItemActions = tw.span(
  "opacity-0 transition-opacity duration-(--duration-fast) ease-(--ease-standard) focus-within:opacity-100 group-hover/recent:opacity-100 has-[[aria-expanded=true]]:opacity-100",
);

export const TocNav = tw.nav`p-3`;

export const MermaidBlock = tw.div(
  "overflow-auto rounded-(--radius-container) border border-(--color-border) p-4",
);

export const TabStripDirtyDot = tw.span`size-1.5 shrink-0 rounded-full bg-(--color-text-accent)`;

export const TabStripCloseButton = tw.span(
  "grid shrink-0 place-items-center rounded-(--radius-inner) p-0.5 opacity-0 transition-opacity duration-(--duration-fast) ease-(--ease-standard) group-hover:opacity-100 hover:bg-(--color-background-muted)",
);
