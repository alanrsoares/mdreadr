import { describe, expect, it } from "bun:test";
import type { Author, BlockAnchor, Note, Suggestion } from "@mdreadr/domain";
import {
  buildReviewStream,
  countReviewStream,
  filterReviewStream,
  isOpenItem,
  pendingSuggestions,
  type ThreadItem,
} from "./stream.ts";

const human: Author = { kind: "human" };
const agent: Author = { kind: "agent", agentId: "claude" };

const anchor: BlockAnchor = { kind: "paragraph", blockId: "block-1", label: "Intro" };

const note = (overrides: Partial<Note> & Pick<Note, "id">): Note => ({
  anchor,
  kind: "comment",
  status: "open",
  replies: [
    {
      id: `${overrides.id}-r0`,
      author: human,
      body: "Why?",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const suggestion = (overrides: Partial<Suggestion> & Pick<Suggestion, "id">): Suggestion => ({
  anchor,
  replacementText: "Better wording.",
  author: agent,
  status: "pending",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("buildReviewStream", () => {
  it("nests a suggestion inside the note it was raised against", () => {
    const stream = buildReviewStream(
      [note({ id: "n1" })],
      [suggestion({ id: "s1", noteId: "n1" })],
    );

    expect(stream).toHaveLength(1);
    expect(stream[0]?.kind).toBe("thread");
    expect((stream[0] as ThreadItem).suggestions.map((s) => s.id)).toEqual(["s1"]);
  });

  it("keeps an unattached suggestion as its own item", () => {
    const stream = buildReviewStream([], [suggestion({ id: "s1" })]);

    expect(stream.map((item) => [item.kind, item.id])).toEqual([["suggestion", "s1"]]);
  });

  it("falls back to loose when noteId points at a note this document lacks", () => {
    const stream = buildReviewStream([], [suggestion({ id: "s1", noteId: "gone" })]);

    expect(stream.map((item) => item.kind)).toEqual(["suggestion"]);
  });

  it("sorts newest first and lets an attached suggestion lift its thread", () => {
    const stream = buildReviewStream(
      [
        note({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
        note({ id: "newer", updatedAt: "2026-01-02T00:00:00.000Z" }),
      ],
      [suggestion({ id: "s1", noteId: "old", updatedAt: "2026-01-03T00:00:00.000Z" })],
    );

    expect(stream.map((item) => item.id)).toEqual(["old", "newer"]);
  });
});

describe("isOpenItem", () => {
  it("treats a resolved note carrying a pending suggestion as open", () => {
    const [item] = buildReviewStream(
      [note({ id: "n1", status: "resolved" })],
      [suggestion({ id: "s1", noteId: "n1" })],
    );

    expect(item && isOpenItem(item)).toBe(true);
  });

  it("treats a resolved note with only settled suggestions as closed", () => {
    const [item] = buildReviewStream(
      [note({ id: "n1", status: "resolved" })],
      [suggestion({ id: "s1", noteId: "n1", status: "accepted" })],
    );

    expect(item && isOpenItem(item)).toBe(false);
  });

  it.each([
    ["open", true],
    ["resolved", false],
    ["wontfix", false],
  ] as const)("reads a bare %s note as open=%p", (status, expected) => {
    const [item] = buildReviewStream([note({ id: "n1", status })], []);

    expect(item && isOpenItem(item)).toBe(expected);
  });

  it.each([
    ["pending", true],
    ["accepted", false],
    ["rejected", false],
    ["completed", false],
  ] as const)("reads a bare %s suggestion as open=%p", (status, expected) => {
    const [item] = buildReviewStream([], [suggestion({ id: "s1", status })]);

    expect(item && isOpenItem(item)).toBe(expected);
  });
});

describe("filterReviewStream", () => {
  const stream = buildReviewStream(
    [note({ id: "open1" }), note({ id: "done1", status: "resolved" })],
    [suggestion({ id: "s1" })],
  );

  it("keeps everything under all", () => {
    expect(filterReviewStream(stream, "all")).toHaveLength(3);
  });

  it("keeps what still asks something of the reader under open", () => {
    expect(
      filterReviewStream(stream, "open")
        .map((item) => item.id)
        .sort(),
    ).toEqual(["open1", "s1"]);
  });

  it("keeps the settled remainder under resolved", () => {
    expect(filterReviewStream(stream, "resolved").map((item) => item.id)).toEqual(["done1"]);
  });

  it("counts the two halves back to the total", () => {
    const counts = countReviewStream(stream);

    expect(counts).toEqual({ open: 2, resolved: 1, total: 3 });
  });
});

describe("pendingSuggestions", () => {
  it("drops the ones already acted on", () => {
    const [item] = buildReviewStream(
      [note({ id: "n1" })],
      [
        suggestion({ id: "s1", noteId: "n1" }),
        suggestion({ id: "s2", noteId: "n1", status: "rejected" }),
      ],
    );

    expect(item?.kind === "thread" && pendingSuggestions(item).map((s) => s.id)).toEqual(["s1"]);
  });
});
