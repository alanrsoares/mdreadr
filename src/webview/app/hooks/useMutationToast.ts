import { useToast } from "@astryxdesign/core/Toast";
import { useCallback } from "react";

function errorMessage(error: unknown): string {
  if (!error) return "Something went wrong";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    // Handle Eden Treaty error format and other error shapes
    const anyError = error as Record<string, unknown>;
    if (anyError.value) {
      if (typeof anyError.value === "string") return anyError.value;
      if (typeof anyError.value === "object" && anyError.value !== null) {
        const valObj = anyError.value as Record<string, unknown>;
        if (typeof valObj.error === "string") return valObj.error;
        if (typeof valObj.message === "string") return valObj.message;
      }
    }
    if (typeof anyError.error === "string") return anyError.error;
    if (typeof anyError.message === "string") return anyError.message;
  }

  try {
    return String(error);
  } catch {
    return "Something went wrong";
  }
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
