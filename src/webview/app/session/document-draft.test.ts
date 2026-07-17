import { describe, expect, test } from "bun:test";
import { discardDraft, draftSaved, editDraft, emptyDraft, isDirty } from "./document-draft.ts";

describe("editDraft / isDirty", () => {
  test("editing sets a dirty draft for that path", () => {
    const draft = editDraft("/tmp/doc.md", "changed", "original");
    expect(isDirty(draft, "/tmp/doc.md")).toBe(true);
  });

  test("editing back to the saved content clears dirtiness", () => {
    const clean = editDraft("/tmp/doc.md", "original", "original");
    expect(isDirty(clean, "/tmp/doc.md")).toBe(false);
    expect(clean).toEqual({ path: "/tmp/doc.md", text: null });
  });

  test("dirty is path-scoped", () => {
    const draft = editDraft("/tmp/a.md", "changed", "original");
    expect(isDirty(draft, "/tmp/a.md")).toBe(true);
    expect(isDirty(draft, "/tmp/b.md")).toBe(false);
  });

  test("editing with a different path replaces the draft", () => {
    const draftB = editDraft("/tmp/b.md", "changed b", "original b");
    expect(draftB).toEqual({ path: "/tmp/b.md", text: "changed b" });
    expect(isDirty(draftB, "/tmp/a.md")).toBe(false);
    expect(isDirty(draftB, "/tmp/b.md")).toBe(true);
  });
});

describe("discardDraft", () => {
  test("resets to the empty draft", () => {
    const dirty = editDraft("/tmp/doc.md", "changed", "original");
    expect(discardDraft(dirty)).toEqual(emptyDraft);
  });
});

describe("draftSaved", () => {
  test("keeps the path but clears the text", () => {
    const dirty = editDraft("/tmp/doc.md", "changed", "original");
    const saved = draftSaved(dirty);
    expect(saved).toEqual({ path: "/tmp/doc.md", text: null });
    expect(isDirty(saved, "/tmp/doc.md")).toBe(false);
  });
});
