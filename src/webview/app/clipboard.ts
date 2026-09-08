/**
 * The reader runs in a webview whose origin is not always a secure context, so
 * `navigator.clipboard` can be missing outright. The `execCommand` path is the
 * fallback that still works there, the same reasoning as `editorCommands.ts`.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through: a rejected permission still has the legacy path.
    }
  }

  const scratch = document.createElement("textarea");
  scratch.value = text;
  // Off-screen rather than `display: none`: a hidden textarea cannot be
  // selected, and selection is what `execCommand("copy")` reads.
  scratch.setAttribute("aria-hidden", "true");
  scratch.style.position = "fixed";
  scratch.style.top = "-1000px";
  scratch.style.opacity = "0";
  document.body.appendChild(scratch);
  scratch.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    scratch.remove();
  }
}
