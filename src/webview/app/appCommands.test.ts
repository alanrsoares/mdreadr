import { afterEach, expect, test } from "bun:test";
import { clearAppCommands, registerAppCommand, runAppCommand } from "./appCommands.ts";

afterEach(() => {
  clearAppCommands();
});

test("runAppCommand calls the registered handler", () => {
  let calls = 0;
  registerAppCommand("save-document", () => {
    calls += 1;
  });

  expect(runAppCommand("save-document")).toBe(true);
  expect(calls).toBe(1);
});

test("a command nothing listens for is a no-op, not a throw", () => {
  expect(runAppCommand("save-document")).toBe(false);
});

test("the latest registration wins, so the active tab owns the command", () => {
  const seen: string[] = [];
  registerAppCommand("save-document", () => seen.push("parked"));
  registerAppCommand("save-document", () => seen.push("active"));

  runAppCommand("save-document");

  expect(seen).toEqual(["active"]);
});

test("cleanup only removes the handler it installed", () => {
  const seen: string[] = [];
  const cleanupParked = registerAppCommand("save-document", () => seen.push("parked"));
  registerAppCommand("save-document", () => seen.push("active"));

  // The parked tab unmounts after the new one took over: its cleanup must not
  // leave the command unhandled.
  cleanupParked();
  runAppCommand("save-document");

  expect(seen).toEqual(["active"]);
});

test("cleanup unregisters when it is still the current handler", () => {
  const cleanup = registerAppCommand("close-tab", () => undefined);
  cleanup();

  expect(runAppCommand("close-tab")).toBe(false);
});
