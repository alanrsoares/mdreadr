import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isOk } from "@onrails/result";
import { forgetRecent, loadRecents, touchRecent } from "./recents.ts";

describe("recents", () => {
  let tempHome: string;
  let originalConfigDir: string | undefined;

  beforeEach(async () => {
    originalConfigDir = process.env.MDREADR_CONFIG_DIR;
    tempHome = await mkdtemp(join(tmpdir(), "mdreadr-recents-test-"));
    // The config location, not HOME: `configDir` keeps every suite off the
    // developer's own recents, so HOME is no longer what points at it.
    process.env.MDREADR_CONFIG_DIR = join(tempHome, ".config", "mdreadr");
  });

  afterEach(async () => {
    if (originalConfigDir === undefined) delete process.env.MDREADR_CONFIG_DIR;
    else process.env.MDREADR_CONFIG_DIR = originalConfigDir;
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

  test("forgetRecent drops one path and leaves the rest in order", async () => {
    const keep = join(tempHome, "keep.md");
    const drop = join(tempHome, "drop.md");
    await writeFile(keep, "# Keep");
    await writeFile(drop, "# Drop");
    await touchRecent(keep);
    await touchRecent(drop);

    const forgotten = await forgetRecent(drop);

    expect(isOk(forgotten)).toBe(true);
    if (isOk(forgotten)) {
      expect(forgotten.value).toEqual([keep]);
    }

    const reloaded = await loadRecents();
    expect(isOk(reloaded)).toBe(true);
    if (isOk(reloaded)) {
      expect(reloaded.value).toEqual([keep]);
    }
  });

  test("forgetRecent on a path that is not listed is a no-op, not an error", async () => {
    const keep = join(tempHome, "keep.md");
    await writeFile(keep, "# Keep");
    await touchRecent(keep);

    const forgotten = await forgetRecent(join(tempHome, "never-added.md"));

    expect(isOk(forgotten)).toBe(true);
    if (isOk(forgotten)) {
      expect(forgotten.value).toEqual([keep]);
    }
  });
});
