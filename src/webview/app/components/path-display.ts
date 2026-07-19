export type RecentPathMenuLabel = {
  /** SideNav label + collapsed tooltip */
  menuLabel: string;
  /** Full path for screen readers when menu label is abbreviated */
  ariaLabel: string;
};

type RecentPathDisplay = {
  /** File name */
  label: string;
  /** Parent path when basename collisions need disambiguation */
  hint?: string;
};

const splitPath = (path: string): string[] => path.split(/[/\\]/).filter(Boolean);

function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

/** Shorten long directory hints while keeping the distinguishing tail. */
function abbreviatePathHint(hint: string, maxLength = 32): string {
  if (hint.length <= maxLength) return hint;
  const tail = hint.slice(-(maxLength - 1));
  const slash = tail.indexOf("/");
  const trimmed = slash >= 0 ? tail.slice(slash + 1) : tail;
  return trimmed.length > 0 ? `…/${trimmed}` : `…${tail}`;
}

/**
 * For each path, compute a basename and optional directory hint.
 * Hints appear only when multiple recents share the same file name.
 */
function buildRecentPathDisplays(paths: readonly string[]): Map<string, RecentPathDisplay> {
  const entries = paths.map((path) => ({ path, parts: splitPath(path) }));
  const byBasename = groupBy(entries, (entry) => entry.parts.at(-1) ?? entry.path);
  const displays = new Map<string, RecentPathDisplay>();

  for (const [, group] of byBasename) {
    if (group.length === 1) {
      const entry = group[0];
      if (!entry) continue;
      displays.set(entry.path, { label: entry.parts.at(-1) ?? entry.path });
      continue;
    }

    const maxParts = Math.max(...group.map((entry) => entry.parts.length));
    let depth = 1;

    while (depth < maxParts) {
      const suffixes = group.map((entry) => entry.parts.slice(-(depth + 1)).join("/"));
      if (new Set(suffixes).size === group.length) break;
      depth += 1;
    }

    for (const entry of group) {
      const basename = entry.parts.at(-1) ?? entry.path;
      const parentParts = entry.parts.slice(-(depth + 1), -1);
      const hint =
        parentParts.length > 0
          ? abbreviatePathHint(parentParts.join("/"))
          : abbreviatePathHint(entry.parts.slice(0, -1).join("/"));

      displays.set(entry.path, { label: basename, hint });
    }
  }

  return displays;
}

/** Last path segment; tolerant of `/` and `\`. */
export const pathFileName = (path: string): string => splitPath(path).at(-1) ?? path;

/** Normalize separators and drop a trailing slash. */
const normalizeDirectory = (path: string): string => path.replace(/\\/g, "/").replace(/\/$/, "");

/**
 * Replace the user's home directory prefix with `~`.
 * Falls back to `/home/{user}` and `/Users/{user}` when home is unknown.
 */
export function formatDisplayPath(path: string, homeDirectory?: string): string {
  const normalizedPath = path.replace(/\\/g, "/");

  if (homeDirectory) {
    const home = normalizeDirectory(homeDirectory);
    if (normalizedPath === home) return "~";
    if (normalizedPath.startsWith(`${home}/`)) {
      return `~${normalizedPath.slice(home.length)}`;
    }
    return path;
  }

  const homeMatch = normalizedPath.match(/^\/(?:home|Users)\/([^/]+)(\/.*)?$/);
  if (!homeMatch) return path;

  const rest = homeMatch[2] ?? "";
  return rest.length === 0 ? "~" : `~${rest}`;
}

/** Collision-aware labels for the Recents sidebar. */
export function formatRecentMenuLabels(paths: readonly string[]): Map<string, RecentPathMenuLabel> {
  const displays = buildRecentPathDisplays(paths);
  const labels = new Map<string, RecentPathMenuLabel>();

  for (const path of paths) {
    const display = displays.get(path);
    if (!display) continue;
    labels.set(path, {
      menuLabel: display.hint ? `${display.label} · ${display.hint}` : display.label,
      ariaLabel: path,
    });
  }

  return labels;
}
