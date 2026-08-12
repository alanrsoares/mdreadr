import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionStore } from "../session.ts";
import { executeCodeModeScript } from "./code-mode-tools.ts";

describe("Code Mode Sandbox (QuickJS WASM)", () => {
  let dir: string;

  beforeEach(async () => {
    sessionStore.resetAllTabs();
    dir = await mkdtemp(join(tmpdir(), "mdreadr-codemode-test-"));
    sessionStore.setDocument(
      { path: join(dir, "guide.md") },
      "# Guide\n\nWelcome to mdreadr Code Mode.\n\n```ts\nconst a = 1;\n```",
    );
  });

  afterEach(async () => {
    sessionStore.clearDocument();
    await rm(dir, { recursive: true, force: true });
  });

  it("queries document, blocks, and session notes via host API", async () => {
    const res = await executeCodeModeScript(`
      const doc = mdreadr.getDocument();
      const blocks = mdreadr.getBlocks();
      const notes = mdreadr.getNotes();
      return { path: doc.path, blockCount: blocks.length, noteCount: notes.length };
    `);

    expect(res.success).toBe(true);
    expect(res.result).toEqual({
      path: join(dir, "guide.md"),
      blockCount: 3,
      noteCount: 0,
    });
  });

  it("adds notes, replies, proposes edits, and updates note status atomically", async () => {
    const res = await executeCodeModeScript(`
      const blocks = mdreadr.getBlocks();
      const codeBlock = blocks.find(b => b.kind === 'code');

      const note = mdreadr.addNote({
        anchor: { kind: 'code', blockId: codeBlock.blockId },
        body: 'Update variable name',
        author: { kind: 'agent', name: 'ReviewAgent' },
        kind: 'request'
      });

      const reply = mdreadr.addReply(note.id, {
        body: 'Proposing fix now',
        author: { kind: 'agent', name: 'Fixer' }
      });

      const suggestion = mdreadr.proposeEdit({
        anchor: { kind: 'code', blockId: codeBlock.blockId },
        replacementText: 'const value = 1;',
        noteId: note.id
      });

      mdreadr.setNoteStatus(note.id, 'resolved');
      return { noteId: note.id, suggestionId: suggestion.id, replyCount: reply.replies.length };
    `);

    expect(res.success).toBe(true);
    expect(res.result).toMatchObject({ replyCount: 2 });
    expect(sessionStore.getNotes()[0]?.status).toBe("resolved");
    expect(sessionStore.getSuggestions()).toHaveLength(1);
  });

  it("captures console.log output", async () => {
    const res = await executeCodeModeScript(`
      console.log("hello", 42);
      return "done";
    `);

    expect(res.success).toBe(true);
    expect(res.logs).toEqual(["hello 42"]);
  });

  it("caps log lines and truncates oversized log messages", async () => {
    const res = await executeCodeModeScript(`
      for (let i = 0; i < 200; i++) {
        console.log("x".repeat(2000));
      }
      return 1;
    `);

    expect(res.success).toBe(true);
    expect(res.logs.length).toBeLessThanOrEqual(100);
    for (const log of res.logs) {
      expect(log.length).toBeLessThanOrEqual(1001); // 1000 + 1 for ellipsis
    }
  });

  it("aborts an infinite loop within timeout budget", async () => {
    const start = Date.now();
    const res = await executeCodeModeScript(`while (true) {}`, 200);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/interrupted|timed out/);
    expect(Date.now() - start).toBeLessThan(2500);
  });

  it("isolates thrown errors without crashing host process", async () => {
    const res = await executeCodeModeScript(`throw new Error("Guest script crash");`);

    expect(res.success).toBe(false);
    expect(res.error).toContain("Guest script crash");
  });

  it("handles syntax errors gracefully", async () => {
    const res = await executeCodeModeScript(`const x = ;`);

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
