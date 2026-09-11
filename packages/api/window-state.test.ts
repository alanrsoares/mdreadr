import { expect, test } from "bun:test";
import { sanitizeWindowFrame } from "./window-state.ts";

test("sanitizeWindowFrame keeps a usable frame as it is", () => {
  const frame = { x: 220, y: 64, width: 1440, height: 900 };
  expect(sanitizeWindowFrame(frame)).toEqual(frame);
});

test("sanitizeWindowFrame pulls an off-screen frame back on screen", () => {
  expect(sanitizeWindowFrame({ x: -32000, y: -32000, width: 1280, height: 840 })).toEqual({
    x: 0,
    y: 0,
    width: 1280,
    height: 840,
  });
});

test("sanitizeWindowFrame refuses a window too small to read in", () => {
  expect(sanitizeWindowFrame({ x: 10, y: 10, width: 40, height: 20 })).toEqual({
    x: 10,
    y: 10,
    width: 640,
    height: 480,
  });
});

test("sanitizeWindowFrame rounds fractional device pixels", () => {
  expect(sanitizeWindowFrame({ x: 10.4, y: 10.6, width: 1280.5, height: 840.2 })).toEqual({
    x: 10,
    y: 11,
    width: 1281,
    height: 840,
  });
});
