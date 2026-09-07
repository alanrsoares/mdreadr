import { Icon } from "@astryxdesign/core/Icon";
import type { KeyboardEvent, MouseEvent } from "react";
import { DocumentTextIcon, XMarkIcon } from "../icons.ts";

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
    <div
      role="tablist"
      aria-label="Open documents"
      className="relative flex h-9 shrink-0 select-none items-stretch overflow-x-auto border-(--color-border) border-b bg-(--color-background-surface) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId;
        const isDirty = dirtyIds.has(tab.id);

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onActivate(tab.id)}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate(tab.id);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                const next = tabs[(index + 1) % tabs.length];
                if (next) onActivate(next.id);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                const prev = tabs[(index - 1 + tabs.length) % tabs.length];
                if (prev) onActivate(prev.id);
              }
            }}
            className={`group relative flex h-full cursor-pointer items-center gap-2 border-(--color-border) border-r px-3 text-xs outline-none transition-colors duration-(--duration-fast) ease-(--ease-standard) focus-visible:ring-(--color-text-accent) focus-visible:ring-1 focus-visible:ring-inset ${
              isActive
                ? "bg-(--reader-paper-bg) font-medium text-(--color-text-primary)"
                : "bg-transparent text-(--color-text-secondary) hover:bg-(--color-background-muted) hover:text-(--color-text-primary)"
            }`}
          >
            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[2px] bg-(--color-text-accent)"
              />
            ) : null}

            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-px bg-(--reader-paper-bg)"
              />
            ) : null}

            <Icon
              icon={DocumentTextIcon}
              size="sm"
              className={`shrink-0 transition-colors ${
                isActive
                  ? "text-(--color-text-accent)"
                  : "text-(--color-text-secondary) opacity-60 group-hover:opacity-100"
              }`}
            />

            <span className="max-w-[140px] truncate leading-none sm:max-w-[200px]">
              {tab.label}
            </span>

            <div className="relative flex size-4.5 shrink-0 items-center justify-center">
              {isDirty ? (
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-(--color-text-accent) transition-opacity duration-(--duration-fast) group-hover:opacity-0"
                />
              ) : null}

              <button
                type="button"
                tabIndex={0}
                aria-label={`Close ${tab.label}`}
                className={`grid size-4.5 place-items-center rounded-(--radius-inner) text-(--color-text-secondary) transition-all duration-(--duration-fast) hover:bg-(--color-background-muted) hover:text-(--color-text-primary) focus:opacity-100 ${
                  isDirty
                    ? "absolute inset-0 opacity-0 group-hover:opacity-100"
                    : isActive
                      ? "opacity-60 hover:opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                }`}
                onClick={(event: MouseEvent) => {
                  event.stopPropagation();
                  onRequestClose(tab.id);
                }}
                onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  onRequestClose(tab.id);
                }}
              >
                <Icon icon={XMarkIcon} size="sm" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
