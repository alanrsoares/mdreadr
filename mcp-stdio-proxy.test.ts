import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendJournalEntries,
  type JournalEntry,
  loadPersistedMaxSeq,
  mergeNewJournalEntries,
  readConfig,
} from "./mcp-stdio-proxy.ts";

describe("mergeNewJournalEntries", () => {
  test("keeps only entries newer than knownMaxSeq, sorted", () => {
    const entries: JournalEntry[] = [
      { seq: 3, ts: "t3", type: "note_added", entityId: "c" },
      { seq: 1, ts: "t1", type: "note_added", entityId: "a" },
      { seq: 2, ts: "t2", type: "note_added", entityId: "b" },
    ];
    expect(mergeNewJournalEntries(1, entries)).toEqual([
      { seq: 2, ts: "t2", type: "note_added", entityId: "b" },
      { seq: 3, ts: "t3", type: "note_added", entityId: "c" },
    ]);
  });

  test("returns an empty array when nothing is newer", () => {
    const entries: JournalEntry[] = [{ seq: 1, ts: "t1", type: "note_added", entityId: "a" }];
    expect(mergeNewJournalEntries(5, entries)).toEqual([]);
  });
});

describe("config + journal file helpers", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "mdreadr-proxy-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("readConfig falls back to the default URL when the file is missing", async () => {
    const config = await readConfig(join(dir, "mcp.json"));
    expect(config).toEqual({ url: "http://127.0.0.1:50932/mcp" });
  });

  test("readConfig reads url/token out of mcpServers.mdreadr", async () => {
    const path = join(dir, "mcp.json");
    await Bun.write(
      path,
      JSON.stringify({ mcpServers: { mdreadr: { url: "http://127.0.0.1:9999/mcp", token: "t" } } }),
    );
    expect(await readConfig(path)).toEqual({ url: "http://127.0.0.1:9999/mcp", token: "t" });
  });

  test("loadPersistedMaxSeq returns 0 when the journal file is missing", async () => {
    expect(await loadPersistedMaxSeq(join(dir, "session.jsonl"))).toBe(0);
  });

  test("appendJournalEntries + loadPersistedMaxSeq round-trip", async () => {
    const path = join(dir, "session.jsonl");
    await appendJournalEntries(path, [
      { seq: 1, ts: "t1", type: "note_added", entityId: "a" },
      { seq: 2, ts: "t2", type: "note_added", entityId: "b" },
    ]);
    expect(await loadPersistedMaxSeq(path)).toBe(2);

    await appendJournalEntries(path, [{ seq: 3, ts: "t3", type: "note_added", entityId: "c" }]);
    expect(await loadPersistedMaxSeq(path)).toBe(3);
  });

  test("appendJournalEntries is a no-op for an empty list (doesn't create the file)", async () => {
    const path = join(dir, "session.jsonl");
    await appendJournalEntries(path, []);
    expect(await loadPersistedMaxSeq(path)).toBe(0);
  });
});
