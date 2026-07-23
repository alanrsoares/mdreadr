import { Icon } from "@astryxdesign/core/Icon";
import { XMarkIcon } from "../icons.ts";
import {
  TabStripCloseButton,
  TabStripDirtyDot,
  TabStripItem,
  TabStripLabel,
  TabStripRow,
} from "../ui/layout.tsx";

export type TabStripEntry = { id: string; label: string };

type TabStripProps = {
  tabs: TabStripEntry[];
  activeId: string | null;
  dirtyIds: ReadonlySet<string>;
  onActivate: (id: string) => void;
  onRequestClose: (id: string) => void;
};

export function TabStrip({ tabs, activeId, dirtyIds, onActivate, onRequestClose }: TabStripProps) {
  if (tabs.length === 0) return null;

  return (
    <TabStripRow role="tablist" aria-label="Open documents">
      {tabs.map((tab) => (
        <TabStripItem
          key={tab.id}
          type="button"
          role="tab"
          title={tab.label}
          aria-selected={tab.id === activeId}
          $active={tab.id === activeId}
          onClick={() => onActivate(tab.id)}
        >
          <TabStripLabel>{tab.label}</TabStripLabel>
          {dirtyIds.has(tab.id) ? <TabStripDirtyDot aria-hidden /> : null}
          <TabStripCloseButton
            role="button"
            aria-label={`Close ${tab.label}`}
            onClick={(event) => {
              event.stopPropagation();
              onRequestClose(tab.id);
            }}
          >
            <Icon icon={XMarkIcon} size="sm" />
          </TabStripCloseButton>
        </TabStripItem>
      ))}
    </TabStripRow>
  );
}
