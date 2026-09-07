import { describe, expect, test } from "bun:test";
import {
  addReply,
  applyBlockEdit,
  applySuggestion,
  blockIdForCode,
  blockIdForHeading,
  blockIdForList,
  blockIdForParagraph,
  blockIdForTable,
  CreateNoteBodySchema,
  createNote,
  createSuggestion,
  extractHeadings,
  findBlockRange,
  findNote,
  findSuggestion,
  listDocumentBlocks,
  parseNotesFileJson,
  resolveBlockRawMarkdown,
  resolveBlockText,
  SaveDocumentBodySchema,
  setNoteStatus,
  setSuggestionStatus,
} from "@mdreadr/domain";
import { isErr, isOk } from "@onrails/result";

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
      { id: "title", level: 1, text: "Title", line: 0 },
      { id: "section", level: 2, text: "Section", line: 2 },
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

describe("findBlockRange, resolveBlockRawMarkdown, applyBlockEdit", () => {
  const content = [
    "# Document Title",
    "",
    "First paragraph with **bold** text.",
    "",
    "```typescript",
    "const val = 42;",
    "```",
    "",
    "## Section Two",
    "",
    "Second paragraph with *italic* text.",
  ].join("\n");

  test("finds block range and resolves raw markdown for paragraph", () => {
    const blockId = blockIdForParagraph("First paragraph with bold text.", 0);
    const anchor = { kind: "paragraph" as const, blockId };
    const range = findBlockRange(content, anchor);
    expect(range).toBeDefined();
    expect(content.slice(range?.start, range?.end)).toBe("First paragraph with **bold** text.");
    expect(resolveBlockRawMarkdown(content, anchor)).toBe("First paragraph with **bold** text.");
  });

  test("finds block range and resolves raw markdown for heading", () => {
    const anchor = { kind: "heading" as const, blockId: "heading-section-two" };
    const range = findBlockRange(content, anchor);
    expect(range).toBeDefined();
    expect(content.slice(range?.start, range?.end)).toBe("## Section Two");
    expect(resolveBlockRawMarkdown(content, anchor)).toBe("## Section Two");
  });

  test("finds block range and resolves raw markdown for code block", () => {
    const blockId = blockIdForCode("const val = 42;\n", "typescript", 0);
    const anchor = { kind: "code" as const, blockId };
    const range = findBlockRange(content, anchor);
    expect(range).toBeDefined();
    expect(content.slice(range?.start, range?.end)).toBe("```typescript\nconst val = 42;\n```");
    expect(resolveBlockRawMarkdown(content, anchor)).toBe("```typescript\nconst val = 42;\n```");
  });

  test("applies block edit in place cleanly", () => {
    const blockId = blockIdForParagraph("First paragraph with bold text.", 0);
    const anchor = { kind: "paragraph" as const, blockId };
    const updated = applyBlockEdit(content, anchor, "Updated paragraph with `code`.");
    expect(updated).toBeDefined();
    expect(updated).toContain("Updated paragraph with `code`.");
    expect(updated).toContain("# Document Title");
    expect(updated).toContain("## Section Two");
    expect(updated).toContain("const val = 42;");
  });

  test("applies block edit to change heading level and text", () => {
    const anchor = { kind: "heading" as const, blockId: "heading-section-two" };
    const updated = applyBlockEdit(content, anchor, "### Renamed Subsection");
    expect(updated).toBeDefined();
    expect(updated).toContain("### Renamed Subsection");
    expect(updated).not.toContain("## Section Two");
  });

  test("applies block edit to code blocks", () => {
    const blockId = blockIdForCode("const val = 42;\n", "typescript", 0);
    const anchor = { kind: "code" as const, blockId };
    const updated = applyBlockEdit(
      content,
      anchor,
      "```typescript\nconst val = 100;\nconst extra = true;\n```",
    );
    expect(updated).toBeDefined();
    expect(updated).toContain("const val = 100;");
    expect(updated).toContain("const extra = true;");
  });

  test("returns undefined when block anchor is not found", () => {
    const anchor = { kind: "paragraph" as const, blockId: "nonexistent" };
    expect(findBlockRange(content, anchor)).toBeUndefined();
    expect(resolveBlockRawMarkdown(content, anchor)).toBeUndefined();
    expect(applyBlockEdit(content, anchor, "foo")).toBeUndefined();
  });

  test("finds and edits list blocks, and preserves paragraph resolution after lists", () => {
    const docWithList = [
      "# Doc",
      "",
      "Before paragraph.",
      "",
      "- Item A",
      "- Item B",
      "",
      "After paragraph.",
    ].join("\n");

    const listText = "Item A\nItem B";
    const listAnchor = {
      kind: "list" as const,
      blockId: blockIdForList(listText, 0),
    };
    const listRaw = resolveBlockRawMarkdown(docWithList, listAnchor);
    expect(listRaw).toBe("- Item A\n- Item B");

    const editedListDoc = applyBlockEdit(docWithList, listAnchor, "- Item A\n- Item B\n- Item C");
    expect(editedListDoc).toBeDefined();
    expect(editedListDoc).toContain("- Item C");
    expect(editedListDoc).toContain("After paragraph.");

    const afterParagraphAnchor = {
      kind: "paragraph" as const,
      blockId: blockIdForParagraph("After paragraph.", 0),
    };
    const afterRaw = resolveBlockRawMarkdown(docWithList, afterParagraphAnchor);
    expect(afterRaw).toBe("After paragraph.");
  });

  test("finds and edits table blocks", () => {
    const docWithTable = [
      "# Tables",
      "",
      "| Name | Age |",
      "| --- | --- |",
      "| Alice | 30 |",
      "",
      "End of doc.",
    ].join("\n");

    const tableText = "Name | Age\nAlice | 30";
    const tableAnchor = {
      kind: "table" as const,
      blockId: blockIdForTable(tableText, 0),
    };
    const tableRaw = resolveBlockRawMarkdown(docWithTable, tableAnchor);
    expect(tableRaw).toBe("| Name | Age |\n| --- | --- |\n| Alice | 30 |");

    const editedTableDoc = applyBlockEdit(
      docWithTable,
      tableAnchor,
      "| Name | Age |\n| --- | --- |\n| Alice | 31 |",
    );
    expect(editedTableDoc).toBeDefined();
    expect(editedTableDoc).toContain("| Alice | 31 |");
    expect(editedTableDoc).toContain("End of doc.");
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

describe("suggestions domain", () => {
  test("createSuggestion starts pending", () => {
    const suggestion = createSuggestion({
      anchor: { kind: "document", blockId: "document-root" },
      replacementText: "new text",
      author: { kind: "agent" },
    });
    expect(suggestion.status).toBe("pending");
    expect(suggestion.replacementText).toBe("new text");
  });

  test("setSuggestionStatus updates status and updatedAt", () => {
    const suggestion = createSuggestion({
      anchor: { kind: "document", blockId: "document-root" },
      replacementText: "new text",
      author: { kind: "agent" },
    });
    const updated = setSuggestionStatus(suggestion, "accepted");
    expect(updated.status).toBe("accepted");
    expect(updated.id).toBe(suggestion.id);
  });

  test("findSuggestion returns ok for a known id and err otherwise", () => {
    const suggestion = createSuggestion({
      anchor: { kind: "document", blockId: "document-root" },
      replacementText: "new text",
      author: { kind: "agent" },
    });
    const found = findSuggestion([suggestion], suggestion.id);
    expect(isOk(found) && found.value).toEqual(suggestion);

    const missing = findSuggestion([suggestion], "does-not-exist");
    expect(isErr(missing) && missing.error).toEqual({
      _tag: "SuggestionNotFound",
      id: "does-not-exist",
    });
  });

  test("applySuggestion replaces the whole document for a document anchor", () => {
    const result = applySuggestion(
      "old content",
      { kind: "document", blockId: "document-root" },
      "new content",
    );
    expect(result).toBe("new content");
  });

  test("applySuggestion splices a block anchor's current text", () => {
    const content = "Intro paragraph.\n\n# Title\n\noriginal paragraph\n";
    const heading = extractHeadings(content)[0];
    if (!heading) throw new Error("expected a Title heading");
    const blockId = blockIdForHeading(heading);
    const result = applySuggestion(content, { kind: "heading", blockId }, "# New Title\n");
    expect(result).toBe("Intro paragraph.\n\n# New Title\n");
  });

  test("applySuggestion returns undefined when the anchor no longer matches", () => {
    const result = applySuggestion(
      "# Title\n",
      { kind: "paragraph", blockId: "paragraph-stale" },
      "x",
    );
    expect(result).toBeUndefined();
  });
});

describe("listDocumentBlocks", () => {
  const content = [
    "# Title",
    "",
    "Intro paragraph.",
    "",
    "## Code",
    "",
    "```ts",
    "const x = 1;",
    "```",
    "",
  ].join("\n");

  test("lists heading, paragraph and code blocks in document order", () => {
    const blocks = listDocumentBlocks(content);
    expect(blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "heading", "code"]);
  });

  test("block ids match the canonical blockId functions", () => {
    const blocks = listDocumentBlocks(content);
    const [title, intro, code, codeBlock] = blocks;
    const [titleHeading, codeHeading] = extractHeadings(content);
    if (!titleHeading || !codeHeading) throw new Error("expected two headings");

    expect(title?.blockId).toBe(blockIdForHeading(titleHeading));
    expect(intro?.blockId).toBe(blockIdForParagraph("Intro paragraph.", 0));
    expect(code?.blockId).toBe(blockIdForHeading(codeHeading));
    expect(codeBlock?.blockId).toBe(blockIdForCode("const x = 1;", "ts", 0));
    expect(codeBlock?.language).toBe("ts");
  });

  test("ids resolve back through resolveBlockText", () => {
    const codeBlock = listDocumentBlocks(content).find((block) => block.kind === "code");
    if (!codeBlock) throw new Error("expected a code block");
    expect(resolveBlockText(content, { kind: "code", blockId: codeBlock.blockId })).toBe(
      "const x = 1;",
    );
  });

  test("carries the enclosing heading trail on nested blocks", () => {
    const codeBlock = listDocumentBlocks(content).find((block) => block.kind === "code");
    expect(codeBlock?.headingPath).toEqual(["Title", "Code"]);
  });

  test("disambiguates repeated blocks by occurrence", () => {
    const dupes = ["dup", "", "dup", ""].join("\n");
    const [first, second] = listDocumentBlocks(dupes);
    expect(first?.blockId).toBe(blockIdForParagraph("dup", 0));
    expect(second?.blockId).toBe(blockIdForParagraph("dup", 1));
    expect(first?.blockId).not.toBe(second?.blockId);
  });
});
