import { Outline } from "@astryxdesign/core/Outline";
import type { TocEntry } from "@mdreadr/domain";
import { blockIdForHeading } from "@mdreadr/domain";
import type { RefObject } from "react";
import { useOutlineScrollSpy } from "../hooks/useOutlineScrollSpy.ts";
import { EmptyState, TocNav } from "../ui/layout.tsx";

type TocSidebarProps = {
  entries: TocEntry[];
  scrollRootRef: RefObject<HTMLElement | null>;
  documentKey?: string;
};

export const TocSidebar = ({ entries, scrollRootRef, documentKey }: TocSidebarProps) => {
  const items = entries.map((entry) => ({
    id: blockIdForHeading(entry),
    label: entry.text,
    level: entry.level,
  }));

  const activeId = useOutlineScrollSpy(scrollRootRef, items, documentKey);

  return entries.length === 0 ? (
    <EmptyState>
      <p>No headings yet.</p>
    </EmptyState>
  ) : (
    <TocNav>
      <Outline density="compact" items={items} activeId={activeId} />
    </TocNav>
  );
};
