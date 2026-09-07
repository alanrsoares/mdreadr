import { describe, expect, it } from "bun:test";
import { isErr } from "@onrails/result";
import { openExternalUrl } from "./external.ts";

/** Only the rejection paths are exercised here: the accepted ones hand the url
 *  to the OS, which would open a real browser window. */
describe("openExternalUrl", () => {
  it.each([
    "file:///etc/passwd",
    "views://mainview/CONTEXT.md",
    "javascript:alert(1)",
    "not a url",
    "",
  ])("refuses %p without spawning an opener", async (url) => {
    const result = await openExternalUrl(url);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error._tag).toBe("ExternalSchemeRejected");
  });
});
