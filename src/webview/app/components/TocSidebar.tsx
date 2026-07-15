import { Outline } from "@astryxdesign/core/Outline";
import type { TocEntry } from "@mdreadr/domain";
import { blockIdForHeading } from "@mdreadr/domain";
import { EmptyState, TocNav } from "../ui/layout.tsx";

type TocSidebarProps = {
  entries: TocEntry[];
};

export const TocSidebar = ({ entries }: TocSidebarProps) =>
  entries.length === 0 ? (
    <EmptyState>
      <p>No headings yet.</p>
    </EmptyState>
  ) : (
    <TocNav>
      <Outline
        density="compact"
        items={entries.map((entry) => ({
          id: blockIdForHeading(entry),
          label: entry.text,
          level: entry.level,
        }))}
      />
    </TocNav>
  );
