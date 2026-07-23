import { Icon } from "@astryxdesign/core/Icon";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { XMarkIcon } from "../icons.ts";
import { TabStripCloseButton, TabStripDirtyDot } from "../ui/layout.tsx";

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
    <TabList
      value={activeId ?? ""}
      onChange={onActivate}
      size="sm"
      hasDivider
      aria-label="Open documents"
      className="overflow-x-auto bg-(--color-background-surface) px-2"
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          className="group"
          value={tab.id}
          label={tab.label}
          endContent={
            <>
              {dirtyIds.has(tab.id) ? <TabStripDirtyDot aria-hidden /> : null}
              <TabStripCloseButton
                role="button"
                tabIndex={-1}
                aria-label={`Close ${tab.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestClose(tab.id);
                }}
              >
                <Icon icon={XMarkIcon} size="sm" />
              </TabStripCloseButton>
            </>
          }
        />
      ))}
    </TabList>
  );
}
