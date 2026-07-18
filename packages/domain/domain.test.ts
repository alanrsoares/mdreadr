import { describe, expect, test } from "bun:test";
import {
  addReply,
  blockIdForCode,
  blockIdForHeading,
  blockIdForParagraph,
  CreateNoteBodySchema,
  createNote,
  extractHeadings,
  findNote,
  parseNotesFileJson,
  resolveBlockText,
  SaveDocumentBodySchema,
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
    expect(note.kind).toBe("comment");
    expect(note.replies).toHaveLength(1);
    expect(note.replies[0]?.body).toBe("Needs review");
  });

  test("creates an edit-request note when kind is given", () => {
    const note = createNote({
      anchor: { kind: "document", blockId: "document-root" },
      body: "Add a haiku here",
      author: { kind: "human" },
      kind: "request",
    });

    expect(note.kind).toBe("request");
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

  test("builds stable paragraph block ids from content hash", () => {
    const first = blockIdForParagraph("Same text", 0);
    const second = blockIdForParagraph("Same text", 0);
    const duplicate = blockIdForParagraph("Same text", 1);
    expect(first).toBe(second);
    expect(first).not.toBe(duplicate);
  });

  test("builds stable code block ids from content and language", () => {
    const id = blockIdForCode("console.log(1)", "ts", 0);
    expect(id.startsWith("code-")).toBe(true);
    expect(blockIdForCode("console.log(1)", "ts", 0)).toBe(id);
    expect(blockIdForCode("console.log(1)", "js", 0)).not.toBe(id);
  });
});

describe("CreateNoteBodySchema", () => {
  const base = {
    anchor: { kind: "document" as const, blockId: "document-root" },
    body: "Hello",
    author: { kind: "human" as const },
  };

  test("defaults kind to comment when omitted", () => {
    const result = CreateNoteBodySchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("comment");
    }
  });

  test("accepts an explicit request kind", () => {
    const result = CreateNoteBodySchema.safeParse({ ...base, kind: "request" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("request");
    }
  });

  test("rejects an unknown kind", () => {
    const result = CreateNoteBodySchema.safeParse({ ...base, kind: "question" });
    expect(result.success).toBe(false);
  });
});

describe("resolveBlockText", () => {
  const content = [
    "# Title",
    "",
    "Some paragraph text.",
    "",
    "## Section",
    "",
    "```ts",
    "console.log(1)",
    "```",
  ].join("\n");

  test("returns the whole document for a document anchor", () => {
    const text = resolveBlockText(content, { kind: "document", blockId: "document-root" });
    expect(text).toBe(content);
  });

  test("resolves a paragraph anchor to its text", () => {
    const blockId = blockIdForParagraph("Some paragraph text.", 0);
    const text = resolveBlockText(content, { kind: "paragraph", blockId });
    expect(text).toBe("Some paragraph text.");
  });

  test("resolves a code anchor to its content", () => {
    const blockId = blockIdForCode("console.log(1)", "ts", 0);
    const text = resolveBlockText(content, { kind: "code", blockId });
    expect(text).toBe("console.log(1)");
  });

  test("resolves a heading anchor to its section", () => {
    const headings = extractHeadings(content);
    const section = headings[1];
    if (!section) throw new Error("expected a Section heading");
    const blockId = blockIdForHeading(section);
    const text = resolveBlockText(content, { kind: "heading", blockId });
    expect(text).toContain("## Section");
    expect(text).toContain("console.log(1)");
  });

  test("returns undefined when the anchor no longer matches", () => {
    const text = resolveBlockText(content, { kind: "paragraph", blockId: "paragraph-stale" });
    expect(text).toBeUndefined();
  });
});

describe("SaveDocumentBodySchema", () => {
  test("accepts a path and content", () => {
    const result = SaveDocumentBodySchema.safeParse({ path: "/tmp/doc.md", content: "hello" });
    expect(result.success).toBe(true);
  });

  test("rejects an empty path", () => {
    const result = SaveDocumentBodySchema.safeParse({ path: "", content: "hello" });
    expect(result.success).toBe(false);
  });

  test("rejects a missing content field", () => {
    const result = SaveDocumentBodySchema.safeParse({ path: "/tmp/doc.md" });
    expect(result.success).toBe(false);
  });
});
