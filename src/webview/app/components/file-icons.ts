import { CodeBracketIcon, DocumentIcon, DocumentTextIcon, PhotoIcon } from "../icons.ts";

type HeroIcon = typeof DocumentTextIcon;

/**
 * Recents holds whatever the reader has opened, which is mostly markdown but
 * also the images and sources they landed on from a link. One icon for all of
 * them made a collapsed rail unreadable, so each family gets its own.
 */
const ICONS_BY_EXTENSION: Record<string, HeroIcon> = {
  md: DocumentTextIcon,
  markdown: DocumentTextIcon,
  mdx: DocumentTextIcon,
  txt: DocumentTextIcon,
  avif: PhotoIcon,
  gif: PhotoIcon,
  jpeg: PhotoIcon,
  jpg: PhotoIcon,
  png: PhotoIcon,
  svg: PhotoIcon,
  webp: PhotoIcon,
  css: CodeBracketIcon,
  go: CodeBracketIcon,
  js: CodeBracketIcon,
  json: CodeBracketIcon,
  jsx: CodeBracketIcon,
  py: CodeBracketIcon,
  rs: CodeBracketIcon,
  sh: CodeBracketIcon,
  toml: CodeBracketIcon,
  ts: CodeBracketIcon,
  tsx: CodeBracketIcon,
  yaml: CodeBracketIcon,
  yml: CodeBracketIcon,
};

/** The extension of a path's file name, lowercased, or "" when it has none. */
export const fileExtension = (path: string): string => {
  const name = path.split(/[/\\]/).at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  // A leading dot is a dotfile's name, not an extension: `.gitignore` has none.
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/** The icon for a file, falling back to the plain document for the unknown. */
export const fileIcon = (path: string): HeroIcon =>
  ICONS_BY_EXTENSION[fileExtension(path)] ?? DocumentIcon;
