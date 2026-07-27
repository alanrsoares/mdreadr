import { expect, test } from "bun:test";
import {
  buildMacOpenScript,
  buildMacSaveScript,
  escapeAppleScriptString,
  isSupportedDocumentPath,
  isWorkspacePathAllowed,
  toAppleScriptTypeList,
  toZenityFileFilters,
} from "./documents.ts";

test("toZenityFileFilters maps markdown patterns", () => {
  expect(toZenityFileFilters(["*.md"])).toEqual(["Markdown | *.md", "All files | *"]);
});

test("toZenityFileFilters maps json patterns", () => {
  expect(toZenityFileFilters(["*.json"])).toEqual(["JSON | *.json", "All files | *"]);
});

test("toZenityFileFilters defaults to all files", () => {
  expect(toZenityFileFilters(undefined)).toEqual(["All files | *"]);
});

test("toAppleScriptTypeList maps glob patterns to extensions", () => {
  expect(toAppleScriptTypeList(["*.md", "*.json"])).toBe('{"md", "json"}');
});

test("toAppleScriptTypeList returns null when unfiltered", () => {
  expect(toAppleScriptTypeList(undefined)).toBeNull();
  expect(toAppleScriptTypeList(["*"])).toBeNull();
});

test("escapeAppleScriptString escapes quotes and backslashes", () => {
  expect(escapeAppleScriptString('a"b\\c')).toBe('a\\"b\\\\c');
});

test("buildMacOpenScript includes type filter", () => {
  expect(buildMacOpenScript("Open file", ["*.md"])).toBe(
    'POSIX path of (choose file with prompt "Open file" of type {"md"})',
  );
});

test("buildMacOpenScript omits type filter when unfiltered", () => {
  expect(buildMacOpenScript("Open file", undefined)).toBe(
    'POSIX path of (choose file with prompt "Open file")',
  );
});

test("buildMacSaveScript splits default path into location and name", () => {
  expect(buildMacSaveScript("Save file", "/tmp/notes.json")).toBe(
    'POSIX path of (choose file name with prompt "Save file" default name "notes.json" default location (POSIX file "/tmp" as alias))',
  );
});

test("buildMacSaveScript handles bare filenames", () => {
  expect(buildMacSaveScript("Save file", "notes.json")).toBe(
    'POSIX path of (choose file name with prompt "Save file" default name "notes.json")',
  );
});

const HOME = "/Users/testuser";

test("isWorkspacePathAllowed accepts a path inside the open Document's directory", () => {
  expect(isWorkspacePathAllowed("/opt/project/notes.json", "/opt/project/doc.md", HOME)).toBe(true);
});

test("isWorkspacePathAllowed accepts a nested path inside the Document's directory", () => {
  expect(isWorkspacePathAllowed("/opt/project/sub/notes.json", "/opt/project/doc.md", HOME)).toBe(
    true,
  );
});

test("isWorkspacePathAllowed rejects a path outside the Document's directory and home", () => {
  expect(isWorkspacePathAllowed("/opt/other/notes.json", "/opt/project/doc.md", HOME)).toBe(false);
});

test("isWorkspacePathAllowed rejects a sibling directory that merely shares a prefix", () => {
  expect(isWorkspacePathAllowed("/opt/project-evil/notes.json", "/opt/project/doc.md", HOME)).toBe(
    false,
  );
});

test("isWorkspacePathAllowed accepts paths under Documents, Desktop, and home itself", () => {
  expect(isWorkspacePathAllowed(`${HOME}/Documents/notes.json`, null, HOME)).toBe(true);
  expect(isWorkspacePathAllowed(`${HOME}/Desktop/notes.json`, null, HOME)).toBe(true);
  expect(isWorkspacePathAllowed(`${HOME}/notes.json`, null, HOME)).toBe(true);
});

test("isWorkspacePathAllowed rejects paths outside home when no Document is open", () => {
  expect(isWorkspacePathAllowed("/etc/passwd", null, HOME)).toBe(false);
});

test("isSupportedDocumentPath accepts .md and .markdown, case-insensitively", () => {
  expect(isSupportedDocumentPath("/opt/project/doc.md")).toBe(true);
  expect(isSupportedDocumentPath("/opt/project/DOC.MD")).toBe(true);
  expect(isSupportedDocumentPath("/opt/project/doc.markdown")).toBe(true);
});

test("isSupportedDocumentPath rejects other extensions", () => {
  expect(isSupportedDocumentPath("/opt/project/doc.txt")).toBe(false);
  expect(isSupportedDocumentPath("/opt/project/doc")).toBe(false);
});
