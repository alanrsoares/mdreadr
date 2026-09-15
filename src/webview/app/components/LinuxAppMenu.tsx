import { DropdownMenu, type DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import { HStack } from "@astryxdesign/core/HStack";
import { useState } from "react";
import { runAppCommand } from "../appCommands.ts";
import { isLinuxPlatform, shortcutLabel } from "../platform.ts";

/**
 * Stand-in for the native application menu on Linux.
 *
 * Electrobun's `ApplicationMenu.setApplicationMenu` has no GTK backend — the
 * native layer logs "Application menus are not supported on Linux" and
 * no-ops — which is why `buildApplicationMenu` in src/bun/index.ts skips
 * Linux entirely rather than building a menu nothing will ever show. Without
 * this, Linux windows ship with no File/Edit/View menu at all: no native one
 * exists, and there was no webview fallback either.
 *
 * It renders as a menu bar rather than a hamburger: the top-level titles sit
 * inline and horizontal at the left of the window chrome, each dropping its
 * own list, which is where a GTK/Qt user looks for File/Edit/View. Commands
 * route through the same bridges the (macOS-only) native menu uses —
 * `appCommands.ts` for state the bun process cannot hold, `__MDREADR_EDIT__`
 * for undo/redo — so the two platforms expose the same actions even though
 * only one gets OS chrome for them.
 */

const runEdit = (method: "undo" | "redo"): void => {
  (
    window as unknown as {
      __MDREADR_EDIT__?: { undo: () => void; redo: () => void };
    }
  ).__MDREADR_EDIT__?.[method]();
};

type MenuBarMenu = {
  title: string;
  items: DropdownMenuOption[];
};

const menus: MenuBarMenu[] = [
  {
    title: "File",
    items: [
      {
        label: "Open…",
        endContent: shortcutLabel("O"),
        onClick: () => runAppCommand("open-document"),
      },
      { type: "divider" },
      {
        label: "Save",
        endContent: shortcutLabel("S"),
        onClick: () => runAppCommand("save-document"),
      },
      { type: "divider" },
      {
        label: "Close Tab",
        endContent: shortcutLabel("W"),
        onClick: () => runAppCommand("close-tab"),
      },
    ],
  },
  {
    title: "Edit",
    items: [
      { label: "Undo", endContent: shortcutLabel("Z"), onClick: () => runEdit("undo") },
      { label: "Redo", endContent: shortcutLabel("⇧Z"), onClick: () => runEdit("redo") },
      { type: "divider" },
      {
        label: "Find…",
        endContent: shortcutLabel("F"),
        onClick: () => runAppCommand("find-in-document"),
      },
    ],
  },
  {
    title: "View",
    items: [
      {
        label: "Toggle Preview / Edit",
        endContent: shortcutLabel("E"),
        onClick: () => runAppCommand("toggle-view-mode"),
      },
      { type: "divider" },
      {
        label: "Toggle Navigation",
        endContent: shortcutLabel("1"),
        onClick: () => runAppCommand("toggle-navigation-sidebar"),
      },
      {
        label: "Toggle Notes",
        endContent: shortcutLabel("2"),
        onClick: () => runAppCommand("toggle-notes-sidebar"),
      },
    ],
  },
];

function MenuBar() {
  // One open title at a time, held here rather than per-menu, because a menu
  // bar's defining behaviour is cross-menu: with one menu open, pointing at a
  // neighbouring title switches to it without a second click, the way native
  // menu bars track the pointer.
  const [openTitle, setOpenTitle] = useState<string | null>(null);

  return (
    <HStack gap={0} vAlign="center">
      {menus.map((menu) => (
        <div
          key={menu.title}
          onPointerEnter={() => {
            if (openTitle !== null) setOpenTitle(menu.title);
          }}
        >
          <DropdownMenu
            button={{ label: menu.title, variant: "ghost", size: "sm" }}
            hasChevron={false}
            placement="below"
            alignment="start"
            // Shortcut hints sit in `endContent`, so a trigger-width menu would
            // wrap every row; size to the widest row instead.
            menuWidth="max-content"
            items={menu.items}
            isMenuOpen={openTitle === menu.title}
            onOpenChange={(isOpen) => setOpenTitle(isOpen ? menu.title : null)}
          />
        </div>
      ))}
    </HStack>
  );
}

/** Nothing to stand in for anywhere but Linux — macOS gets the native menu bar,
 *  and a future Windows build would get its own native chrome too. */
export function LinuxAppMenu() {
  if (!isLinuxPlatform()) return null;

  return <MenuBar />;
}
