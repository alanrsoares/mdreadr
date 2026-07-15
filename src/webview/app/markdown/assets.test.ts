import { expect, test } from "bun:test";
import { createAssetResolver } from "./assets.ts";

const resolve = createAssetResolver("http://127.0.0.1:4000", "/home/alan/repo/README.md");

test("createAssetResolver rewrites relative sources to the asset endpoint", () => {
  expect(resolve("docs/hero.png")).toBe(
    "http://127.0.0.1:4000/documents/asset?doc=%2Fhome%2Falan%2Frepo%2FREADME.md&src=docs%2Fhero.png",
  );
});

test("createAssetResolver leaves absolute URLs untouched", () => {
  for (const src of [
    "https://img.shields.io/badge/x-y-green",
    "http://example.com/a.png",
    "//cdn.example.com/a.png",
    "data:image/png;base64,x",
  ]) {
    expect(resolve(src)).toBe(src);
  }
});

test("createAssetResolver passes through without a document path", () => {
  const bare = createAssetResolver("http://127.0.0.1:4000", undefined);
  expect(bare("docs/hero.png")).toBe("docs/hero.png");
});
