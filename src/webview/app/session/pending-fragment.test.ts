import { beforeEach, expect, test } from "bun:test";
import { clearPendingFragment, requestFragment, takeFragment } from "./pending-fragment.ts";

beforeEach(() => {
  clearPendingFragment();
});

test("takeFragment returns the fragment requested for that path", () => {
  requestFragment("/docs/SPEC.md", "anchors");
  expect(takeFragment("/docs/SPEC.md")).toBe("anchors");
});

test("takeFragment consumes it, so a later render does not scroll again", () => {
  requestFragment("/docs/SPEC.md", "anchors");
  takeFragment("/docs/SPEC.md");
  expect(takeFragment("/docs/SPEC.md")).toBeNull();
});

test("takeFragment ignores a fragment meant for another Document", () => {
  requestFragment("/docs/SPEC.md", "anchors");
  expect(takeFragment("/DESIGN.md")).toBeNull();
});

test("a second link click replaces an unclaimed fragment", () => {
  requestFragment("/docs/SPEC.md", "anchors");
  requestFragment("/DESIGN.md", "hard-bans");
  expect(takeFragment("/docs/SPEC.md")).toBeNull();
  expect(takeFragment("/DESIGN.md")).toBe("hard-bans");
});

test("nothing is pending until a link asks for it", () => {
  expect(takeFragment("/docs/SPEC.md")).toBeNull();
});
