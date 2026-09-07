/** Modifier-key labels for UI copy. The app ships on macOS and Linux, so a
 *  hard-coded ⌘ is wrong half the time: every shortcut hint reads from here. */

const APPLE_PLATFORM = /mac|iphone|ipad|ipod/i;

export const isApplePlatform = (): boolean =>
  APPLE_PLATFORM.test(navigator.userAgent) || APPLE_PLATFORM.test(navigator.platform);

/** `⌘B` / `Ctrl+B` — the separator differs by platform convention too. */
export const shortcutLabel = (key: string): string =>
  isApplePlatform() ? `⌘${key}` : `Ctrl+${key}`;
