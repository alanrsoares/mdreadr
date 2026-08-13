import type { DragEvent as ReactDragEvent } from "react";
import { useCallback, useRef } from "react";
import { useMutationToast } from "./useMutationToast.ts";

export type FileDropHandlers = {
  onDragEnter: (event: ReactDragEvent) => void;
  onDragLeave: (event: ReactDragEvent) => void;
  onDragOver: (event: ReactDragEvent) => void;
  onDrop: (event: ReactDragEvent) => void;
};

type UseFileDropOptions = {
  onOpenPath: (path: string) => void;
  onDropUnsaved: (name: string, content: string) => void;
  onDragOverChange: (isDragOver: boolean) => void;
};

/**
 * Markdown file-drop handling shared by the saved and unsaved reader tabs.
 * Drag depth is counted so nested children entering and leaving don't flicker
 * the overlay.
 */
export function useFileDrop({
  onOpenPath,
  onDropUnsaved,
  onDragOverChange,
}: UseFileDropOptions): FileDropHandlers {
  const { showError } = useMutationToast();
  const dragDepthRef = useRef(0);

  const onDrop = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      onDragOverChange(false);

      const file = event.dataTransfer.files.item(0);
      if (!file) return;

      const isMarkdown = /\.(md|markdown)$/i.test(file.name);
      const path = (file as File & { path?: string }).path;

      // Some environments (Electron) expose the real filesystem path on drop.
      // Electrobun's WKWebView never does — fall through to reading the
      // File's content directly below.
      if (path) {
        if (isMarkdown) onOpenPath(path);
        return;
      }

      if (!isMarkdown) {
        showError("Open dropped file", `"${file.name}" is not a markdown file.`);
        return;
      }

      void file
        .text()
        .then((text) => onDropUnsaved(file.name, text))
        .catch(() => showError("Open dropped file", "Could not read the dropped file."));
    },
    [onOpenPath, onDropUnsaved, onDragOverChange, showError],
  );

  const onDragEnter = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      if (!event.dataTransfer.types.includes("Files")) return;
      dragDepthRef.current += 1;
      onDragOverChange(true);
    },
    [onDragOverChange],
  );

  const onDragLeave = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      if (!event.dataTransfer.types.includes("Files")) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) onDragOverChange(false);
    },
    [onDragOverChange],
  );

  const onDragOver = useCallback((event: ReactDragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  return { onDragEnter, onDragLeave, onDragOver, onDrop };
}
