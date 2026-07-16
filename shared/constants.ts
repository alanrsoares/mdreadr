import { homedir } from "node:os";

export const NOTES_SCHEMA_VERSION = 1 as const;
export const APP_NAME = "mdreadr";
export const APP_IDENTIFIER = "dev.mdreadr.app";
export const RECENTS_FILENAME = "recents.json";
export const MAX_RECENTS = 20;

export const configDir = (): string => `${process.env.HOME ?? homedir()}/.config/mdreadr`;
