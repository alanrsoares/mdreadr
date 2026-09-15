import { DropdownMenu, type DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import { HStack } from "@astryxdesign/core/HStack";
import { useEffect, useState } from "react";
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
 *
 * The accelerators are the menu's job too. macOS gets them from the native
 * menu item; on Linux nothing binds them unless this does, which is why the
 * shortcut is declared on the entry itself rather than printed as a hint next
 * to a binding kept somewhere else — a label and a key that can drift apart
 * is how Ctrl+E, Ctrl+1 and Ctrl+2 came to be advertised but dead.
 */

const runEdit = (method: "undo" | "redo"): void => {
  (
    window as unknown as {
      __MDREADR_EDIT__?: { undo: () => void; redo: () => void };
    }
  ).__MDREADR_EDIT__?.[method]();
};

/** `key` matches `KeyboardEvent.key`, lowercased. Cmd/Ctrl is implied: every
 *  entry in this menu has it, as the whole menu mirrors `CmdOrCtrl+…` items. */
type Shortcut = { key: string; shift?: boolean };

type MenuEntry = { type: "divider" } | { label: string; shortcut: Shortcut; run: () => void };

type MenuBarMenu = {
  title: string;
  entries: MenuEntry[];
};

const menus: MenuBarMenu[] = [
  {
    title: "File",
    entries: [
      {
        label: "Open…",
        shortcut: { key: "o" },
        run: () => runAppCommand("open-document"),
      },
      { type: "divider" },
      {
        label: "Save",
        shortcut: { key: "s" },
        run: () => runAppCommand("save-document"),
      },
      { type: "divider" },
      {
        label: "Close Tab",
        shortcut: { key: "w" },
        run: () => runAppCommand("close-tab"),
      },
    ],
  },
  {
    title: "Edit",
    entries: [
      { label: "Undo", shortcut: { key: "z" }, run: () => runEdit("undo") },
      { label: "Redo", shortcut: { key: "z", shift: true }, run: () => runEdit("redo") },
      { type: "divider" },
      {
        label: "Find…",
        shortcut: { key: "f" },
        run: () => runAppCommand("find-in-document"),
      },
    ],
  },
  {
    title: "View",
    entries: [
      {
        label: "Toggle Preview / Edit",
        shortcut: { key: "e" },
        run: () => runAppCommand("toggle-view-mode"),
      },
      { type: "divider" },
      {
        label: "Toggle Navigation",
        shortcut: { key: "1" },
        run: () => runAppCommand("toggle-navigation-sidebar"),
      },
      {
        label: "Toggle Notes",
        shortcut: { key: "2" },
        run: () => runAppCommand("toggle-notes-sidebar"),
      },
    ],
  },
];

const toDropdownItems = (menu: MenuBarMenu): DropdownMenuOption[] =>
  menu.entries.map((entry) =>
    "type" in entry
      ? entry
      : {
          label: entry.label,
          endContent: shortcutLabel(entry.shortcut.key.toUpperCase(), {
            shift: entry.shortcut.shift,
          }),
          onClick: entry.run,
        },
  );

const commands = menus.flatMap((menu) =>
  menu.entries.filter(
    (entry): entry is Extract<MenuEntry, { label: string }> => !("type" in entry),
  ),
);

/**
 * Binds every menu accelerator, because on Linux no OS menu does.
 *
 * Capture phase and `stopImmediatePropagation` make this the only handler for
 * these chords: ReaderPage and ReaderTab bind Cmd/Ctrl+O, W, S and F on their
 * own window listeners for macOS, where the native menu swallows the key
 * before the webview sees it. Without stopping here, those would run the same
 * command a second time on Linux — two file pickers for one Ctrl+O.
 */
function useMenuShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const command = commands.find(
        ({ shortcut }) => shortcut.key === key && (shortcut.shift ?? false) === event.shiftKey,
      );
      if (!command) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      command.run();
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}

function MenuBar() {
  // One open title at a time, held here rather than per-menu, because a menu
  // bar's defining behaviour is cross-menu: with one menu open, pointing at a
  // neighbouring title switches to it without a second click, the way native
  // menu bars track the pointer.
  const [openTitle, setOpenTitle] = useState<string | null>(null);

  useMenuShortcuts();

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
            items={toDropdownItems(menu)}
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
