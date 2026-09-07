import { ResultAsync } from "@onrails/result";

export type ExternalOpenError =
  /** A scheme the reader will not hand to the OS. */
  | { _tag: "ExternalSchemeRejected"; url: string }
  /** The platform opener could not be run, or exited non-zero. */
  | { _tag: "ExternalOpenFailed"; url: string; message: string };

/** Only what a Document legitimately links out to. Anything else (`file:`,
 *  `views:`, `javascript:`) would be handing arbitrary local execution to
 *  whatever markdown the reader happens to have opened. */
const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/** `open` on macOS, `xdg-open` on Linux: the OS decides which app handles it. */
const openerCommand = (url: string): string[] =>
  process.platform === "darwin" ? ["open", url] : ["xdg-open", url];

/**
 * Hands a link from a Document to the OS. The reader is a webview, so following
 * an external link in place would navigate the app off its own bundle and lose
 * the session; it goes to the system browser instead.
 */
export const openExternalUrl = (url: string): ResultAsync<string, ExternalOpenError> =>
  ResultAsync.fromPromise(
    (async () => {
      const parsed = URL.parse(url);
      if (!parsed || !ALLOWED_SCHEMES.has(parsed.protocol)) {
        throw { _tag: "ExternalSchemeRejected", url } satisfies ExternalOpenError;
      }

      const spawned = Bun.spawn(openerCommand(parsed.href), {
        stdout: "ignore",
        stderr: "pipe",
      });
      const code = await spawned.exited;
      if (code !== 0) {
        const stderr = await new Response(spawned.stderr).text();
        throw {
          _tag: "ExternalOpenFailed",
          url,
          message: stderr.trim() || `opener exited with ${code}`,
        } satisfies ExternalOpenError;
      }

      return parsed.href;
    })(),
    (error) => {
      if (typeof error === "object" && error !== null && "_tag" in error) {
        return error as ExternalOpenError;
      }
      return {
        _tag: "ExternalOpenFailed",
        url,
        message: error instanceof Error ? error.message : String(error),
      } satisfies ExternalOpenError;
    },
  );
