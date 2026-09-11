import { ResultAsync } from "@onrails/result";
import { configFilePath, ensureConfigDir } from "../../packages/api/config-paths.ts";

const UPDATE_LOG_FILENAME = "update.log";

/** A shipped launch has no console, so the trail is kept on disk instead. */
export const updateLogPath = (): string => configFilePath(UPDATE_LOG_FILENAME);

/** Enough for many launches' worth of status changes, small enough to read. */
const MAX_LOG_BYTES = 256 * 1024;

export type UpdateLogEntry = {
  status: string;
  message?: string;
  error?: string;
};

/** Keeps one entry on one line: a wrapped message is unreadable in a tail. */
const oneLine = (value: string): string => value.replace(/\s+/g, " ").trim();

export const formatUpdateLogLine = (entry: UpdateLogEntry, at: Date): string => {
  const parts = [at.toISOString(), entry.status];
  if (entry.message) parts.push(oneLine(entry.message));
  if (entry.error) parts.push(`error=${oneLine(entry.error)}`);
  return `${parts.join(" ")}\n`;
};

export type UpdateLogError = { _tag: "UpdateLogIo"; message: string };

/**
 * Appends one line to the update log, starting the file over once it passes
 * its cap. Failing to log is never allowed to fail an update, so every caller
 * discards the Result — it exists so a test can assert the write.
 */
export const appendUpdateLog = (
  entry: UpdateLogEntry,
  at: Date = new Date(),
): ResultAsync<void, UpdateLogError> =>
  ResultAsync.fromPromise(
    (async () => {
      await ensureConfigDir();
      const path = updateLogPath();
      const file = Bun.file(path);
      const existing = (await file.exists()) && file.size <= MAX_LOG_BYTES ? await file.text() : "";
      await Bun.write(path, `${existing}${formatUpdateLogLine(entry, at)}`);
    })(),
    (error) => ({
      _tag: "UpdateLogIo" as const,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
