import { DropdownMenu, type DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { runAppCommand } from "../appCommands.ts";
import { Bars3Icon } from "../icons.ts";
import { isApplePlatform, shortcutLabel } from "../platform.ts";

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
 * This renders the same commands as one hamburger menu in the reader chrome,
 * routed through the same bridges the (macOS-only) native menu uses —
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

const items: DropdownMenuOption[] = [
  {
    label: "File",
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
    label: "Edit",
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
    label: "View",
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

/** Nothing to stand in for on macOS, where the native menu bar already does this. */
export function LinuxAppMenu() {
  if (isApplePlatform()) return null;

  return (
    <DropdownMenu
      button={{
        label: "Menu",
        variant: "ghost",
        isIconOnly: true,
        icon: <Icon icon={Bars3Icon} size="sm" />,
      }}
      items={items}
    />
  );
}
