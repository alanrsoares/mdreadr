/**
 * Bridges the native application menu to the reader.
 *
 * The Edit menu already reaches CodeMirror this way (`editorCommands.ts`); the
 * File and View menus need the same route for actions that live in React state
 * (which Tab is open, whether a sidebar is collapsed). The bun process cannot
 * hold that state, so the menu sends a command name and whichever component
 * owns the action answers it.
 *
 * A command with no handler registered is a no-op, not a crash: menus render
 * before the reader mounts, and File actions mean nothing with no Document
 * open.
 */

export type AppCommand =
  | "open-document"
  | "save-document"
  | "close-tab"
  | "toggle-notes-sidebar"
  | "toggle-navigation-sidebar"
  | "toggle-view-mode";

const GLOBAL_KEY = "__MDREADR_APP__";

const handlers = new Map<AppCommand, () => void>();

/**
 * Registers the handler for one command, and returns the cleanup that removes
 * it. Last registration wins: the active Tab owns `save-document`, and a Tab
 * unmounting must not take over from the one that replaced it, which is why
 * cleanup only clears the handler it installed.
 */
export function registerAppCommand(command: AppCommand, handler: () => void): () => void {
  handlers.set(command, handler);
  return () => {
    if (handlers.get(command) === handler) handlers.delete(command);
  };
}

/** Runs a command. `false` when nothing is listening for it. */
export function runAppCommand(command: AppCommand): boolean {
  const handler = handlers.get(command);
  if (!handler) return false;
  handler();
  return true;
}

/** Test seam: drops every registration. */
export function clearAppCommands(): void {
  handlers.clear();
}

/** Exposes the bridge on `window` so the bun process can call it by name. */
export function installAppCommandBridge(): void {
  (window as unknown as Record<string, { run: (command: AppCommand) => boolean }>)[GLOBAL_KEY] = {
    run: runAppCommand,
  };
}
