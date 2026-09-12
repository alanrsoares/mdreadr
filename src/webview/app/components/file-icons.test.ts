import { describe, expect, test } from "bun:test";
import {
  DEFAULT_FILE_ICON,
  fileExtension,
  fileIcon,
  ICONS_BY_EXTENSION,
  ICONS_BY_NAME,
} from "./file-icons.ts";

describe("fileExtension", () => {
  test.each([
    ["/Users/reader/notes/doc.md", "md"],
    ["/Users/reader/notes/PHOTO.PNG", "png"],
    ["C:\\Users\\reader\\notes\\doc.md", "md"],
    ["/Users/reader/archive.tar.gz", "gz"],
    ["/Users/reader/notes/README", ""],
    ["/Users/reader/.gitignore", ""],
  ])("reads %p as %p", (path, extension) => {
    expect(fileExtension(path)).toBe(extension);
  });
});

describe("fileIcon", () => {
  test.each([
    ["/Users/reader/doc.md", ICONS_BY_EXTENSION.md],
    ["/Users/reader/notes.txt", ICONS_BY_EXTENSION.txt],
    ["/Users/reader/shot.png", ICONS_BY_EXTENSION.png],
    ["/Users/reader/logo.svg", ICONS_BY_EXTENSION.svg],
    ["/Users/reader/index.ts", ICONS_BY_EXTENSION.ts],
    ["/Users/reader/config.yml", ICONS_BY_EXTENSION.yml],
    ["/Users/reader/paper.pdf", ICONS_BY_EXTENSION.pdf],
    ["/Users/reader/LICENSE", ICONS_BY_NAME.license],
    ["/Users/reader/.gitignore", ICONS_BY_NAME[".gitignore"]],
    ["/Users/reader/unknown.xyz", DEFAULT_FILE_ICON],
    ["/Users/reader/README", DEFAULT_FILE_ICON],
  ])("gives %p its own icon", (path, icon) => {
    expect(fileIcon(path)).toBe(icon);
  });
});
