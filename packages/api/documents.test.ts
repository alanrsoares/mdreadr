import { expect, test } from "bun:test";
import {
  buildMacOpenScript,
  buildMacSaveScript,
  escapeAppleScriptString,
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
