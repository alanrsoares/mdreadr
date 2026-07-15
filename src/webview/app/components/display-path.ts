/** Normalize separators and drop a trailing slash. */
function normalizeDirectory(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/$/, "");
}

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
