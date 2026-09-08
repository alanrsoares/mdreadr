import { useCallback } from "react";
import { copyText } from "../clipboard.ts";
import { useMutationToast } from "./useMutationToast.ts";

/**
 * Copy with a result the reader can see. `copyText` can fail for reasons the
 * caller cannot prevent (no clipboard permission, no secure context), and a
 * copy action that quietly does nothing is worse than one that says so.
 */
export function useCopy(): (text: string, label: string) => Promise<void> {
  const { showError, showSuccess } = useMutationToast();

  return useCallback(
    async (text: string, label: string) => {
      if (await copyText(text)) {
        showSuccess(`${label} copied`);
        return;
      }
      showError(`Copy ${label.toLowerCase()}`, new Error("The clipboard is not available."));
    },
    [showError, showSuccess],
  );
}
