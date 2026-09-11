import { describe, expect, test } from "bun:test";
import { downloadFailure } from "./update-outcome.ts";

describe("downloadFailure", () => {
  test("reports the updater's own error", () => {
    expect(
      downloadFailure({ updateReady: false, error: "Failed to download update: HTTP 503" }),
    ).toBe("Failed to download update: HTTP 503");
  });

  test("reports a bundle that was never prepared, even without an error", () => {
    expect(downloadFailure({ updateReady: false, error: "" })).toBe(
      "The update bundle was not prepared",
    );
  });

  test("passes a prepared bundle", () => {
    expect(downloadFailure({ updateReady: true, error: "" })).toBeUndefined();
  });
});
