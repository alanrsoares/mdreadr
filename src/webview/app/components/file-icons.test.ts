import { describe, expect, test } from "bun:test";
import { CodeBracketIcon, DocumentIcon, DocumentTextIcon, PhotoIcon } from "../icons.ts";
import { fileExtension, fileIcon } from "./file-icons.ts";

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
    ["/Users/reader/doc.md", DocumentTextIcon],
    ["/Users/reader/notes.txt", DocumentTextIcon],
    ["/Users/reader/shot.png", PhotoIcon],
    ["/Users/reader/logo.svg", PhotoIcon],
    ["/Users/reader/index.ts", CodeBracketIcon],
    ["/Users/reader/config.yml", CodeBracketIcon],
    ["/Users/reader/paper.pdf", DocumentIcon],
    ["/Users/reader/LICENSE", DocumentIcon],
  ])("gives %p its own icon", (path, icon) => {
    expect(fileIcon(path)).toBe(icon);
  });
});
