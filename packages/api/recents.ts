import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { okAsync, ResultAsync } from "@onrails/result";
import { z } from "zod";

const RECENTS_FILENAME = "recents.json";
const MAX_RECENTS = 20;

const RecentsSchema = z.object({
  paths: z.array(z.string()),
});

export type RecentsError = { _tag: "RecentsIo"; message: string };

const configDir = (): string => `${process.env.HOME ?? homedir()}/.config/mdreadr`;

const recentsPath = (): string => `${configDir()}/${RECENTS_FILENAME}`;

async function ensureConfigDir(): Promise<void> {
  await mkdir(configDir(), { recursive: true });
}

export const loadRecents = (): ResultAsync<string[], RecentsError> =>
  ResultAsync.fromPromise(
    (async () => {
      const file = Bun.file(recentsPath());
      if (!(await file.exists())) {
        return [] as string[];
      }
      const raw = await file.json();
      const parsed = RecentsSchema.safeParse(raw);
      return !parsed.success ? ([] as string[]) : parsed.data.paths;
    })(),
    (error) => ({
      _tag: "RecentsIo",
      message: error instanceof Error ? error.message : String(error),
    }),
  );

export const saveRecents = (paths: string[]): ResultAsync<void, RecentsError> =>
  ResultAsync.fromPromise(
    (async () => {
      await ensureConfigDir();
      await Bun.write(
        recentsPath(),
        JSON.stringify({ paths: paths.slice(0, MAX_RECENTS) }, null, 2),
      );
    })(),
    (error) => ({
      _tag: "RecentsIo",
      message: error instanceof Error ? error.message : String(error),
    }),
  );

export const touchRecent = (path: string): ResultAsync<string[], RecentsError> =>
  loadRecents().andThen((paths) => {
    const next = [path, ...paths.filter((item) => item !== path)].slice(0, MAX_RECENTS);
    return saveRecents(next).map(() => next);
  });

export const readRecents = (): ResultAsync<string[], RecentsError> =>
  loadRecents().orElse(() => okAsync([]));

export const toRecentsHttpError = (error: RecentsError): { error: string } => ({
  error: error.message,
});
