import iconsJson from "@iconify-json/vscode-icons/icons.json";
import type { ComponentType, SVGProps } from "react";
import { createElement } from "react";

export type FileIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface IconData {
  body: string;
  width?: number;
  height?: number;
}

const rawIcons = iconsJson.icons as Record<string, IconData>;
const defaultWidth = iconsJson.width ?? 32;
const defaultHeight = iconsJson.height ?? 32;

const createSvgIcon = (iconName: string): FileIconComponent => {
  const icon = rawIcons[iconName] ?? rawIcons["default-file"];
  const width = icon?.width ?? defaultWidth;
  const height = icon?.height ?? defaultHeight;
  const body = icon?.body ?? "";

  const SvgIcon: FileIconComponent = (props: SVGProps<SVGSVGElement>) =>
    createElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      width: "1em",
      height: "1em",
      fill: "currentColor",
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static bundled icon body from @iconify-json/vscode-icons
      dangerouslySetInnerHTML: { __html: body },
      ...props,
    });

  return SvgIcon;
};

export const DEFAULT_FILE_ICON = createSvgIcon("default-file");

export const ICONS_BY_EXTENSION = {
  // Markdown & docs
  md: createSvgIcon("file-type-markdown"),
  markdown: createSvgIcon("file-type-markdown"),
  mdx: createSvgIcon("file-type-mdx"),
  txt: createSvgIcon("file-type-text"),
  pdf: createSvgIcon("file-type-pdf2"),

  // Images
  avif: createSvgIcon("file-type-avif"),
  gif: createSvgIcon("file-type-image"),
  jpeg: createSvgIcon("file-type-image"),
  jpg: createSvgIcon("file-type-image"),
  png: createSvgIcon("file-type-image"),
  svg: createSvgIcon("file-type-svg"),
  webp: createSvgIcon("file-type-webp"),

  // Code & config
  c: createSvgIcon("file-type-c"),
  cpp: createSvgIcon("file-type-cpp"),
  cs: createSvgIcon("file-type-csharp"),
  css: createSvgIcon("file-type-css"),
  go: createSvgIcon("file-type-go"),
  html: createSvgIcon("file-type-html"),
  java: createSvgIcon("file-type-java"),
  js: createSvgIcon("file-type-js"),
  json: createSvgIcon("file-type-json"),
  jsx: createSvgIcon("file-type-reactjs"),
  lua: createSvgIcon("file-type-lua"),
  php: createSvgIcon("file-type-php"),
  py: createSvgIcon("file-type-python"),
  rb: createSvgIcon("file-type-ruby"),
  rs: createSvgIcon("file-type-rust"),
  sh: createSvgIcon("file-type-shell"),
  sql: createSvgIcon("file-type-sql"),
  swift: createSvgIcon("file-type-swift"),
  toml: createSvgIcon("file-type-toml"),
  ts: createSvgIcon("file-type-typescript"),
  tsx: createSvgIcon("file-type-reactts"),
  xml: createSvgIcon("file-type-xml"),
  yaml: createSvgIcon("file-type-yaml"),
  yml: createSvgIcon("file-type-yaml"),
} satisfies Record<string, FileIconComponent>;

/** Special exact filenames that get their own icon regardless of extension. */
export const ICONS_BY_NAME = {
  license: createSvgIcon("file-type-license"),
  dockerfile: createSvgIcon("file-type-docker"),
  ".gitignore": createSvgIcon("file-type-git"),
} satisfies Record<string, FileIconComponent>;

/** The extension of a path's file name, lowercased, or "" when it has none. */
export const fileExtension = (path: string): string => {
  const name = path.split(/[/\\]/).at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  // A leading dot is a dotfile's name, not an extension: `.gitignore` has none.
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/** The icon for a file, falling back to the plain document for the unknown. */
export const fileIcon = (path: string): FileIconComponent => {
  const name = (path.split(/[/\\]/).at(-1) ?? "").toLowerCase();
  const byName: FileIconComponent | undefined = (
    ICONS_BY_NAME as Record<string, FileIconComponent>
  )[name];
  const byExt: FileIconComponent | undefined = (
    ICONS_BY_EXTENSION as Record<string, FileIconComponent>
  )[fileExtension(path)];
  return byName ?? byExt ?? DEFAULT_FILE_ICON;
};
