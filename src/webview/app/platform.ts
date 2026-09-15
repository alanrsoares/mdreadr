/** Modifier-key labels for UI copy. The app ships on macOS and Linux, so a
 *  hard-coded ⌘ is wrong half the time: every shortcut hint reads from here. */

const APPLE_PLATFORM = /mac|iphone|ipad|ipod/i;
const LINUX_PLATFORM = /linux/i;

export const isApplePlatform = (): boolean =>
  APPLE_PLATFORM.test(navigator.userAgent) || APPLE_PLATFORM.test(navigator.platform);

export const isLinuxPlatform = (): boolean =>
  LINUX_PLATFORM.test(navigator.userAgent) || LINUX_PLATFORM.test(navigator.platform);

type ShortcutModifiers = {
  shift?: boolean;
};

/** `⌘B` / `Ctrl+B` — the separator differs by platform convention too, and so
 *  does how a second modifier reads: `⌘⇧Z` against `Ctrl+Shift+Z`. */
export const shortcutLabel = (key: string, modifiers?: ShortcutModifiers): string => {
  const shift = modifiers?.shift ?? false;
  return isApplePlatform() ? `⌘${shift ? "⇧" : ""}${key}` : `Ctrl+${shift ? "Shift+" : ""}${key}`;
};
