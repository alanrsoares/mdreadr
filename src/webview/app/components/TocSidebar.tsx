import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Outline } from "@astryxdesign/core/Outline";
import type { TocEntry } from "@mdreadr/domain";
import { blockIdForHeading } from "@mdreadr/domain";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from "react";
import { useCallback, useMemo, useState } from "react";
import { useOutlineScrollSpy } from "../hooks/useOutlineScrollSpy.ts";
import { TocNav } from "../ui/layout.tsx";

type TocSidebarProps = {
  entries: TocEntry[];
  scrollRootRef: RefObject<HTMLElement | null>;
  documentKey?: string;
  /**
   * When provided the caller owns navigation — used in edit mode, where the
   * headings live in the CodeMirror document rather than in rendered DOM.
   */
  onSelect?: (entry: TocEntry) => void;
};

export const TocSidebar = ({ entries, scrollRootRef, documentKey, onSelect }: TocSidebarProps) => {
  const items = entries.map((entry) => ({
    id: blockIdForHeading(entry),
    label: entry.text,
    level: entry.level,
  }));

  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [blockIdForHeading(entry), entry])),
    [entries],
  );

  const spiedActiveId = useOutlineScrollSpy(scrollRootRef, items, documentKey);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  // Outline's own navigation gives up when the heading has no element to scroll
  // to, which is exactly the edit-mode case, so item activation is intercepted
  // here instead — for the pointer and for the keyboard.
  const activate = useCallback(
    (target: EventTarget | null): boolean => {
      if (!onSelect || !(target instanceof HTMLElement)) return false;
      const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
      const id = link?.getAttribute("href")?.slice(1);
      if (!id) return false;
      const entry = entriesById.get(id);
      if (!entry) return false;
      setSelectedId(id);
      onSelect(entry);
      return true;
    },
    [onSelect, entriesById],
  );

  const onClickCapture = useCallback(
    (event: ReactMouseEvent) => {
      if (activate(event.target)) event.preventDefault();
    },
    [activate],
  );

  const onKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (activate(event.target)) event.preventDefault();
    },
    [activate],
  );

  return entries.length === 0 ? (
    <EmptyState
      isCompact
      className="h-full justify-center"
      title="No headings yet"
      description="Headings from the document show up here."
    />
  ) : (
    <TocNav
      onClickCapture={onSelect ? onClickCapture : undefined}
      onKeyDownCapture={onSelect ? onKeyDownCapture : undefined}
    >
      <Outline
        density="compact"
        items={items}
        activeId={onSelect ? selectedId : spiedActiveId}
        hasScrollOnClick={!onSelect}
      />
    </TocNav>
  );
};
