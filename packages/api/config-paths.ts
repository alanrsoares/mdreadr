import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";

/** Everything mdreadr keeps between launches lives here: recents, window frame. */
export const configDir = (): string => `${process.env.HOME ?? homedir()}/.config/mdreadr`;

export const configFilePath = (filename: string): string => `${configDir()}/${filename}`;

export async function ensureConfigDir(): Promise<void> {
  await mkdir(configDir(), { recursive: true });
}
