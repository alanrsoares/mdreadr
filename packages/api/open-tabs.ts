import { okAsync, ResultAsync } from "@onrails/result";
import { z } from "zod";
import { configFilePath, ensureConfigDir } from "./config-paths.ts";

const OPEN_TABS_FILENAME = "open-tabs.json";

const OpenTabsSchema = z.object({
  paths: z.array(z.string()),
  /** The Tab that was in front. `null` once its Document is gone from disk. */
  activePath: z.string().nullable(),
});

export type OpenTabs = z.infer<typeof OpenTabsSchema>;

export const noOpenTabs: OpenTabs = { paths: [], activePath: null };

/**
 * Drops Documents that are no longer on disk and, with them, an `activePath`
 * that pointed at one. Restoring a Tab for a deleted file would open the
 * session on an error state the reader did not ask for.
 */
export function keepExistingTabs(tabs: OpenTabs, exists: (path: string) => boolean): OpenTabs {
  const paths = tabs.paths.filter(exists);
  return {
    paths,
    activePath: tabs.activePath && paths.includes(tabs.activePath) ? tabs.activePath : null,
  };
}

/** The Tabs to reopen on launch. An unreadable file restores nothing rather than failing the launch. */
export const loadOpenTabs = (): ResultAsync<OpenTabs, never> =>
  ResultAsync.fromPromise(
    (async () => {
      const file = Bun.file(configFilePath(OPEN_TABS_FILENAME));
      if (!(await file.exists())) return noOpenTabs;
      const parsed = OpenTabsSchema.safeParse(await file.json());
      if (!parsed.success) return noOpenTabs;

      const existing: string[] = [];
      for (const path of parsed.data.paths) {
        if (await Bun.file(path).exists()) existing.push(path);
      }
      return keepExistingTabs(parsed.data, (path) => existing.includes(path));
    })(),
    () => undefined,
  ).orElse(() => okAsync(noOpenTabs));

export const saveOpenTabs = (tabs: OpenTabs): ResultAsync<void, never> =>
  ResultAsync.fromPromise(
    (async () => {
      await ensureConfigDir();
      await Bun.write(configFilePath(OPEN_TABS_FILENAME), JSON.stringify(tabs, null, 2));
    })(),
    () => undefined,
  ).orElse(() => okAsync(undefined));
