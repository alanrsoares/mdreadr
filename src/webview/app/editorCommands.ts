import { redo, undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";

/**
 * Bridges the native Edit menu to the webview's undo/redo.
 *
 * The menu items used to rely on macOS roles, which dispatch `undo:`/`redo:`
 * down the responder chain into WebKit's own editing stack. CodeMirror keeps a
 * separate history, so that route meant two competing undo stacks reconciling
 * by accident — and no route at all on Linux, where those selectors don't
 * exist. Instead the menu now sends an explicit action that the bun process
 * forwards here, so there is exactly one history and both platforms behave the
 * same.
 */

const GLOBAL_KEY = "__MDREADR_EDIT__";

let editorView: EditorView | null = null;

/** Called whenever CodeMirror (re)mounts; null on unmount. */
export function registerEditorView(view: EditorView | null): void {
  editorView = view;
}

function isEditorFocused(): boolean {
  const view = editorView;
  if (!view) return false;
  const active = document.activeElement;
  return active !== null && view.dom.contains(active);
}

// Focus decides the target: the document editor when the caret is in it, and
// otherwise whatever plain input/textarea has focus (note composer, search
// fields), which only the browser's own undo stack knows about.
function run(command: (view: EditorView) => boolean, fallback: "undo" | "redo"): boolean {
  if (isEditorFocused() && editorView) {
    return command(editorView);
  }
  try {
    return document.execCommand(fallback);
  } catch {
    return false;
  }
}

type EditBridge = {
  undo: () => boolean;
  redo: () => boolean;
};

/** Exposes the bridge on `window` so the bun process can call it by name. */
export function installEditBridge(): void {
  const bridge: EditBridge = {
    undo: () => run(undo, "undo"),
    redo: () => run(redo, "redo"),
  };
  (window as unknown as Record<string, EditBridge>)[GLOBAL_KEY] = bridge;
}
