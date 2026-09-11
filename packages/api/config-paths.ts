import { mkdir } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";

/**
 * Everything mdreadr keeps between launches lives here: recents, the window
 * frame, the open Tabs.
 *
 * Under `bun test` it moves to a scratch directory. Opening a Document touches
 * recents and the Tab list, so a test suite that opens fixtures was rewriting
 * the developer's own recents list with paths from `/tmp`.
 */
export const configDir = (): string => {
  const override = process.env.MDREADR_CONFIG_DIR;
  if (override) return override;
  if (process.env.NODE_ENV === "test") return `${tmpdir()}/mdreadr-test-config`;
  return `${process.env.HOME ?? homedir()}/.config/mdreadr`;
};

export const configFilePath = (filename: string): string => `${configDir()}/${filename}`;

export async function ensureConfigDir(): Promise<void> {
  await mkdir(configDir(), { recursive: true });
}
