import { describe, expect, test } from "bun:test";
import { appendUpdateLog, formatUpdateLogLine, updateLogPath } from "./update-log.ts";

const at = new Date("2026-09-12T11:26:50.228Z");

describe("formatUpdateLogLine", () => {
  test("writes the timestamp and status of a bare entry", () => {
    expect(formatUpdateLogLine({ status: "checking" }, at)).toBe(
      "2026-09-12T11:26:50.228Z checking\n",
    );
  });

  test("keeps the message and the error on the same line", () => {
    expect(
      formatUpdateLogLine(
        { status: "error", message: "Failed to download update", error: "HTTP 503" },
        at,
      ),
    ).toBe("2026-09-12T11:26:50.228Z error Failed to download update error=HTTP 503\n");
  });

  test("folds a wrapped message so one entry stays one line", () => {
    expect(formatUpdateLogLine({ status: "error", message: "two\nlines  here" }, at)).toBe(
      "2026-09-12T11:26:50.228Z error two lines here\n",
    );
  });
});

describe("appendUpdateLog", () => {
  test("appends one line per entry under the config directory", async () => {
    await Bun.write(updateLogPath(), "");
    await appendUpdateLog({ status: "checking" }, at);
    await appendUpdateLog({ status: "no-update", message: "Already on latest version" }, at);

    expect(await Bun.file(updateLogPath()).text()).toBe(
      "2026-09-12T11:26:50.228Z checking\n" +
        "2026-09-12T11:26:50.228Z no-update Already on latest version\n",
    );
  });

  test("serializes concurrent writes so no entry is overwritten", async () => {
    await Bun.write(updateLogPath(), "");
    const count = 10;
    const entries = Array.from({ length: count }, (_, i) => ({
      status: `step-${i}`,
      message: `message ${i}`,
    }));

    // Fire all appends concurrently without awaiting between them
    await Promise.all(entries.map((entry) => appendUpdateLog(entry, at)));

    const content = await Bun.file(updateLogPath()).text();
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(count);
    for (const [i, line] of lines.entries()) {
      expect(line).toBe(`2026-09-12T11:26:50.228Z step-${i} message ${i}`);
    }
  });
});
