import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { fromNullable, type Maybe } from "@onrails/maybe";

/**
 * What the editor highlights. `markdown` is the prose path; `file` asks for the
 * grammar matching a path on disk and stays unstyled when there is none;
 * `plain` never highlights.
 */
export type SourceLanguage =
  | { kind: "markdown" }
  | { kind: "plain" }
  | { kind: "file"; path: string };

export const markdownSource: SourceLanguage = { kind: "markdown" };
export const plainSource: SourceLanguage = { kind: "plain" };
export const fileSource = (path: string): SourceLanguage => ({ kind: "file", path });

/**
 * Extensions CodeMirror's language data does not claim, mapped to the grammar a
 * reader would expect. Keyed by extension so a path with directories in it
 * still resolves.
 */
const grammarByExtension: Record<string, string> = {
  bash: "Shell",
  cjs: "JavaScript",
  cts: "TypeScript",
  jsonc: "JSON",
  mjs: "JavaScript",
  mts: "TypeScript",
  ndjson: "JSON",
  zsh: "Shell",
};

/** Last path segment, for both posix and windows separators. */
export function filenameOf(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}

/**
 * The grammar for a path, if CodeMirror ships one. A description carries only
 * metadata — its parser is loaded on demand — so resolving one is cheap.
 */
export function grammarForPath(path: string): Maybe<LanguageDescription> {
  const filename = filenameOf(path);
  const matched = LanguageDescription.matchFilename(languages, filename);
  if (matched !== null) return fromNullable(matched);

  const extension = filename.split(".").at(-1)?.toLowerCase() ?? "";
  const name = grammarByExtension[extension];

  return fromNullable(
    name === undefined ? null : LanguageDescription.matchLanguageName(languages, name),
  );
}
