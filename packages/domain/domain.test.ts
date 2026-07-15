import { describe, expect, test } from "bun:test";
import {
  addReply,
  createNote,
  extractHeadings,
  findNote,
  parseNotesFileJson,
  setNoteStatus,
} from "@mdreadr/domain";
import { isOk } from "@onrails/result";

describe("notes domain", () => {
  test("creates a note with an opening reply", () => {
    const note = createNote({
      anchor: { kind: "document", blockId: "document-root" },
      body: "Needs review",
      author: { kind: "human" },
    });

    expect(note.status).toBe("open");
    expect(note.replies).toHaveLength(1);
    expect(note.replies[0]?.body).toBe("Needs review");
  });

  test("adds replies and updates status", () => {
    const note = createNote({
      anchor: { kind: "heading", blockId: "heading-intro", headingPath: ["Intro"] },
      body: "Question",
      author: { kind: "agent", agentId: "cursor" },
    });

    const withReply = addReply(note, {
      body: "Answer",
      author: { kind: "human" },
    });
    const resolved = setNoteStatus(withReply, "resolved");

    expect(withReply.replies).toHaveLength(2);
    expect(resolved.status).toBe("resolved");
  });

  test("parses notes files", () => {
    const note = createNote({
      anchor: { kind: "document", blockId: "document-root" },
      body: "Hello",
      author: { kind: "human" },
    });

    const parsed = parseNotesFileJson({
      schemaVersion: 1,
      notes: [note],
    });

    expect(isOk(parsed)).toBe(true);
    if (isOk(parsed)) {
      expect(isOk(findNote(parsed.value.notes, note.id))).toBe(true);
    }
  });
});

describe("markdown helpers", () => {
  test("extracts headings for TOC", () => {
    const headings = extractHeadings("# Title\n\n## Section\n");
    expect(headings).toEqual([
      { id: "title", level: 1, text: "Title" },
      { id: "section", level: 2, text: "Section" },
    ]);
  });
});
