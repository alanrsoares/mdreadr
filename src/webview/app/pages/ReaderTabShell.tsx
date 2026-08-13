import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { type ResizableRegion, ResizeHandle } from "@astryxdesign/core/Resizable";
import { Stack } from "@astryxdesign/core/Stack";
import type { ReactNode, RefObject } from "react";
import type { FileDropHandlers } from "../hooks/useFileDrop.ts";
import { ArrowDownTrayIcon } from "../icons.ts";
import { ReaderContent } from "../ui/layout.tsx";

type ReaderTabShellProps = {
  notesSidebar: ResizableRegion;
  /** Left column: table of contents, or its stand-in. */
  outline: ReactNode;
  /** Centre column, rendered inside the sheet's width constraint. */
  children: ReactNode;
  /** Right column: notes and suggestions, or their stand-in. */
  notes: ReactNode;
  mainRef: RefObject<HTMLDivElement | null>;
  drop: FileDropHandlers;
  isDragOver: boolean;
  /** Highlights the notes column while a pinned block is awaiting a note. */
  isNotesPending?: boolean;
};

/**
 * The three-column reader frame: outline, document well, notes. Owned here so
 * ReaderTab and UnsavedReaderTab can't drift apart on layout or drop handling.
 *
 * Responsive contract:
 *   > 1024px  outline 200 | document well | notes (resizable, default 280)
 *   <= 1024px notes collapse (ReaderPage drives it off a media query)
 */
export const ReaderTabShell = ({
  notesSidebar,
  outline,
  children,
  notes,
  mainRef,
  drop,
  isDragOver,
  isNotesPending = false,
}: ReaderTabShellProps) => (
  <Layout
    height="fill"
    start={
      <LayoutPanel
        width={200}
        padding={0}
        hasDivider
        label="Table of contents"
        className="bg-(--color-background-surface)"
      >
        {outline}
      </LayoutPanel>
    }
    content={
      <LayoutContent
        ref={mainRef}
        padding={0}
        label="Document"
        className="relative bg-(--reader-well-bg)"
        {...drop}
      >
        <div
          aria-hidden
          className="reader-main-drop-overlay"
          data-active={isDragOver ? "true" : "false"}
        >
          <Stack gap={2} vAlign="center" hAlign="center" className="reader-drop-overlay-content">
            <Icon icon={ArrowDownTrayIcon} size="lg" />
            Drop to open
          </Stack>
        </div>
        <ReaderContent>{children}</ReaderContent>
      </LayoutContent>
    }
    end={
      <>
        <ResizeHandle
          resizable={notesSidebar.props}
          isReversed
          hasDivider
          label="Resize notes sidebar"
        />
        <LayoutPanel
          resizable={notesSidebar.props}
          padding={0}
          label="Notes"
          data-pending={isNotesPending ? "true" : "false"}
          className="reader-notes-panel bg-(--color-background-surface)"
        >
          {notes}
        </LayoutPanel>
      </>
    }
  />
);
