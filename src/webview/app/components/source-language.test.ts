import { describe, expect, test } from "bun:test";
import { isNone, isSome, map as mapMaybe, unwrapOr } from "@onrails/maybe";
import { filenameOf, grammarForPath } from "./source-language.ts";

const grammarName = (path: string) =>
  unwrapOr(
    mapMaybe(grammarForPath(path), (description) => description.name),
    "",
  );

describe("filenameOf", () => {
  test("takes the last segment of either separator", () => {
    expect(filenameOf("/home/a/notes.ts")).toBe("notes.ts");
    expect(filenameOf("C:\\docs\\notes.ts")).toBe("notes.ts");
    expect(filenameOf("notes.ts")).toBe("notes.ts");
  });
});

describe("grammarForPath", () => {
  test("resolves the grammars CodeMirror claims by extension", () => {
    expect(grammarName("/tmp/main.rs")).toBe("Rust");
    expect(grammarName("/tmp/app.tsx")).toBe("TSX");
    expect(grammarName("/tmp/script.py")).toBe("Python");
    expect(grammarName("/tmp/data.json")).toBe("JSON");
  });

  test("resolves grammars by whole filename", () => {
    expect(grammarName("/repo/Dockerfile")).toBe("Dockerfile");
  });

  test("fills the gaps CodeMirror's table leaves", () => {
    expect(grammarName("/repo/vite.config.mts")).toBe("TypeScript");
    expect(grammarName("/repo/build.cjs")).toBe("JavaScript");
    expect(grammarName("/repo/tsconfig.jsonc")).toBe("JSON");
    expect(grammarName("/repo/.zshrc.zsh")).toBe("Shell");
  });

  test("is none when nothing matches, so the editor stays plain", () => {
    expect(isNone(grammarForPath("/tmp/notes.unknown-ext"))).toBe(true);
    expect(isNone(grammarForPath("/tmp/LICENSE"))).toBe(true);
  });

  test("does not confuse a directory name for a filename", () => {
    expect(isSome(grammarForPath("/some.rs/notes.py"))).toBe(true);
    expect(grammarName("/some.rs/notes.py")).toBe("Python");
  });
});
