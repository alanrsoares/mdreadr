import { ResultAsync } from "@onrails/result";
import { api } from "../treaty.ts";

export type OpenExternalError = { _tag: "OpenExternalFailed"; url: string; message: string };

/**
 * Hands a Document's outbound link to the OS through the main process. Called
 * straight from the reader rather than drilled down as a prop, the same way
 * `getApiBase` already is: it carries no session state, and every rendered
 * Document has the same answer for what an external link means.
 */
export const openExternalLink = (url: string): ResultAsync<string, OpenExternalError> =>
  ResultAsync.fromPromise(
    (async () => {
      const response = await api.system["open-url"].post({ url });
      if (response.error) {
        throw new Error(
          typeof response.error.value === "object" &&
            response.error.value !== null &&
            "error" in response.error.value
            ? String(response.error.value.error)
            : `HTTP ${response.error.status}`,
        );
      }
      return url;
    })(),
    (error) => ({
      _tag: "OpenExternalFailed" as const,
      url,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
