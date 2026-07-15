import { useToast } from "@astryxdesign/core/Toast";
import { useCallback } from "react";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong";
}

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
