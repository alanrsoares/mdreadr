import { describe, expect, it } from "bun:test";
import { receiveDraft } from "./write-sync.ts";

describe("receiveDraft", () => {
  it("takes a Draft nobody emitted for a change from outside", () => {
    expect(receiveDraft([], "new")).toEqual({ external: true, pending: [] });
    expect(receiveDraft(["a"], "new")).toEqual({ external: true, pending: [] });
  });

  it("recognises the echo of its own edit and consumes it", () => {
    expect(receiveDraft(["a"], "a")).toEqual({ external: false, pending: [] });
  });

  it("keeps newer emits when the parent shows an older one", () => {
    expect(receiveDraft(["a", "ab", "abc"], "a")).toEqual({
      external: false,
      pending: ["ab", "abc"],
    });
    expect(receiveDraft(["ab", "abc"], "ab")).toEqual({ external: false, pending: ["abc"] });
  });
});
