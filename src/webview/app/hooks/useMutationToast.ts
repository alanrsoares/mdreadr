import { useToast } from "@astryxdesign/core/Toast";
import { useCallback } from "react";
import { apiErrorMessage } from "../session/reader-api.ts";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : apiErrorMessage(error);

export function useMutationToast() {
  const toast = useToast();

  const showError = useCallback(
    (action: string, error: unknown) => {
      toast({
        type: "error",
        body: `${action} failed: ${errorMessage(error)}`,
        isAutoHide: false,
        uniqueID: `error-${action}`,
      });
    },
    [toast],
  );

  const showSuccess = useCallback(
    (message: string) => {
      toast({ type: "info", body: message, uniqueID: `success-${message}` });
    },
    [toast],
  );

  return { showError, showSuccess };
}
