import { mkdirSync, writeFileSync } from "node:fs";
import { okAsync, ResultAsync } from "@onrails/result";
import { z } from "zod";
import { configDir, configFilePath, ensureConfigDir } from "./config-paths.ts";

const WINDOW_STATE_FILENAME = "window.json";

/** The frame a first launch gets, and the fallback for an unreadable file. */
export const DEFAULT_WINDOW_FRAME = { x: 100, y: 100, width: 1280, height: 840 } as const;

/** Small enough to be a mistake, not a choice: a 40px window has no reader in it. */
const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

export const WindowFrameSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite(),
  height: z.number().finite(),
});

export type WindowFrame = z.infer<typeof WindowFrameSchema>;

export type WindowStateError = { _tag: "WindowStateIo"; message: string };

/**
 * A frame the app can actually open at. A display that went away since the last
 * launch, or a `-32000` minimised frame from a Windows session, would otherwise
 * put the window somewhere the reader cannot reach it.
 */
export function sanitizeWindowFrame(frame: WindowFrame): WindowFrame {
  return {
    x: Math.max(0, Math.round(frame.x)),
    y: Math.max(0, Math.round(frame.y)),
    width: Math.max(MIN_WIDTH, Math.round(frame.width)),
    height: Math.max(MIN_HEIGHT, Math.round(frame.height)),
  };
}

/** The frame to open at. Anything unreadable is the default, never an error the shell has to handle. */
export const loadWindowFrame = (): ResultAsync<WindowFrame, never> =>
  ResultAsync.fromPromise(
    (async () => {
      const file = Bun.file(configFilePath(WINDOW_STATE_FILENAME));
      if (!(await file.exists())) return { ...DEFAULT_WINDOW_FRAME };
      const parsed = WindowFrameSchema.safeParse(await file.json());
      return parsed.success ? sanitizeWindowFrame(parsed.data) : { ...DEFAULT_WINDOW_FRAME };
    })(),
    () => ({ _tag: "WindowStateIo" as const, message: "unreadable" }),
  ).orElse(() => okAsync({ ...DEFAULT_WINDOW_FRAME }));

export const saveWindowFrame = (frame: WindowFrame): ResultAsync<void, WindowStateError> =>
  ResultAsync.fromPromise(
    (async () => {
      await ensureConfigDir();
      await Bun.write(
        configFilePath(WINDOW_STATE_FILENAME),
        JSON.stringify(sanitizeWindowFrame(frame), null, 2),
      );
    })(),
    (error) => ({
      _tag: "WindowStateIo" as const,
      message: error instanceof Error ? error.message : String(error),
    }),
  );

/**
 * The close path's write. The shell exits the process from its own `close`
 * handler, so an async write started there would be killed mid-flight and the
 * last resize of a session would never land.
 */
export function saveWindowFrameSync(frame: WindowFrame): void {
  try {
    mkdirSync(configDir(), { recursive: true });
    writeFileSync(
      configFilePath(WINDOW_STATE_FILENAME),
      JSON.stringify(sanitizeWindowFrame(frame), null, 2),
    );
  } catch {
    // A window frame is not worth failing a quit over.
  }
}
