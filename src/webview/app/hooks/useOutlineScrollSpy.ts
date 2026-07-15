import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

export type OutlineScrollItem = {
  id: string;
};

function resolveActiveId(
  items: OutlineScrollItem[],
  scrollRoot: HTMLElement | null,
): string | undefined {
  if (items.length === 0) return undefined;

  const rootTop = scrollRoot?.getBoundingClientRect().top ?? 0;

  const atBottom =
    scrollRoot != null
      ? scrollRoot.scrollTop + scrollRoot.clientHeight >= scrollRoot.scrollHeight - 2
      : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

  if (atBottom) {
    return items.at(-1)?.id;
  }

  let activeId = items[0]?.id;
  for (const item of items) {
    const element = document.getElementById(item.id);
    if (!element) continue;

    const top = element.getBoundingClientRect().top;
    const marginTop = Number.parseFloat(window.getComputedStyle(element).scrollMarginTop) || 0;

    if (top <= rootTop + marginTop + 1) {
      activeId = item.id;
    } else {
      break;
    }
  }

  return activeId;
}

/** Tracks the active outline item from a dedicated document scroll container. */
export function useOutlineScrollSpy(
  scrollRootRef: RefObject<HTMLElement | null>,
  items: OutlineScrollItem[],
  documentKey?: string,
): string | undefined {
  const [activeId, setActiveId] = useState<string | undefined>(items[0]?.id);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot || itemsRef.current.length === 0) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const nextActiveId = resolveActiveId(itemsRef.current, scrollRoot);
      if (nextActiveId != null) {
        setActiveId((current) => (current === nextActiveId ? current : nextActiveId));
      }
    };

    const onScroll = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(update);
      }
    };

    update();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      scrollRoot.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [scrollRootRef]);

  useEffect(() => {
    if (!documentKey) {
      setActiveId(undefined);
      return;
    }

    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot || itemsRef.current.length === 0) {
      setActiveId(undefined);
      return;
    }

    const nextActiveId = resolveActiveId(itemsRef.current, scrollRoot);
    if (nextActiveId != null) {
      setActiveId(nextActiveId);
    }
  }, [documentKey, scrollRootRef]);

  return activeId;
}
