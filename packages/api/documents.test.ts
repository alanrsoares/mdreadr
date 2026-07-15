import { expect, test } from "bun:test";
import { toZenityFileFilters } from "./documents.ts";

test("toZenityFileFilters maps markdown patterns", () => {
  expect(toZenityFileFilters(["*.md"])).toEqual(["Markdown | *.md", "All files | *"]);
});

test("toZenityFileFilters maps json patterns", () => {
  expect(toZenityFileFilters(["*.json"])).toEqual(["JSON | *.json", "All files | *"]);
});

test("toZenityFileFilters defaults to all files", () => {
  expect(toZenityFileFilters(undefined)).toEqual(["All files | *"]);
});
