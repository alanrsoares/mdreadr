import { describe, expect, test } from "bun:test";
import { subBlockNoun } from "./sub-blocks.ts";

describe("subBlockNoun", () => {
  test("names the part in reader language", () => {
    expect(subBlockNoun("list-item")).toBe("item");
    expect(subBlockNoun("table-row")).toBe("row");
  });
});
