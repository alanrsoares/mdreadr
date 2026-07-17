import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isOk } from "@onrails/result";
import { loadRecents, touchRecent } from "./recents.ts";

describe("recents", () => {
  let tempHome: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    tempHome = await mkdtemp(join(tmpdir(), "mdreadr-recents-test-"));
    process.env.HOME = tempHome;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    if (tempHome) {
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  test("filters out non-existent files on load and writes them back", async () => {
    const file1 = join(tempHome, "file1.md");
    const file2 = join(tempHome, "file2.md");
    await writeFile(file1, "# File 1");
    await writeFile(file2, "# File 2");

    const touch1 = await touchRecent(file1);
    expect(isOk(touch1)).toBe(true);
    const touch2 = await touchRecent(file2);
    expect(isOk(touch2)).toBe(true);

    const loaded1 = await loadRecents();
    expect(isOk(loaded1)).toBe(true);
    if (isOk(loaded1)) {
      expect(loaded1.value).toEqual([file2, file1]);
    }

    await rm(file1);

    const loaded2 = await loadRecents();
    expect(isOk(loaded2)).toBe(true);
    if (isOk(loaded2)) {
      expect(loaded2.value).toEqual([file2]);
    }

    const raw = await Bun.file(join(tempHome, ".config", "mdreadr", "recents.json")).json();
    expect(raw.paths).toEqual([file2]);
  });
});
