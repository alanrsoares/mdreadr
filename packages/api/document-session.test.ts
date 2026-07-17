import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { FSWatcher } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { errAsync, isErr, isOk } from "@onrails/result";
import { createDocumentSession, type WatchFn } from "./document-session.ts";
import { SessionStore } from "./session.ts";

function createFakeWatch() {
  const registered: Array<{ path: string; listener: (eventType: string) => void }> = [];
  const watch: WatchFn = (path, listener) => {
    registered.push({ path, listener });
    return { close: () => {} } as unknown as FSWatcher;
  };
  return { watch, registered };
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe("createDocumentSession", () => {
  let dir: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "mdreadr-document-session-"));
    // openDocument() touches recents.json under configDir(), which resolves
    // from process.env.HOME — redirect it into the temp dir for this suite.
    originalHome = process.env.HOME;
    process.env.HOME = dir;
  });

  afterAll(async () => {
    process.env.HOME = originalHome;
    await rm(dir, { recursive: true, force: true });
  });

  test("open() reads the file, records it on the store, and starts watching", async () => {
    const docPath = join(dir, "doc.md");
    await writeFile(docPath, "# Hello");
    const store = new SessionStore();
    const { watch, registered } = createFakeWatch();
    const session = createDocumentSession({ store, watch });

    const result = await session.open(docPath);

    expect(isErr(result)).toBe(false);
    expect(store.snapshot().document?.path).toBe(docPath);
    expect(store.snapshot().documentContent).toBe("# Hello");
    expect(registered).toHaveLength(1);
    expect(registered[0]?.path).toBe(docPath);
  });

  test("open() on a missing file returns an error and touches neither store nor watcher", async () => {
    const store = new SessionStore();
    const { watch, registered } = createFakeWatch();
    const session = createDocumentSession({ store, watch });

    const result = await session.open(join(dir, "missing.md"));

    expect(isErr(result)).toBe(true);
    expect(store.snapshot().document).toBeNull();
    expect(registered).toHaveLength(0);
  });

  test("isAssetAllowed is true only for the currently open document's path", async () => {
    const docPath = join(dir, "asset-doc.md");
    await writeFile(docPath, "# Doc");
    const store = new SessionStore();
    const { watch } = createFakeWatch();
    const session = createDocumentSession({ store, watch });

    expect(session.isAssetAllowed(docPath)).toBe(false);

    await session.open(docPath);

    expect(session.isAssetAllowed(docPath)).toBe(true);
    expect(session.isAssetAllowed(join(dir, "other.md"))).toBe(false);
  });

  test("onChange fires when the watcher reports content that differs from the snapshot", async () => {
    const docPath = join(dir, "watched.md");
    await writeFile(docPath, "original");
    const store = new SessionStore();
    const { watch, registered } = createFakeWatch();
    const session = createDocumentSession({ store, watch });
    await session.open(docPath);

    const fired: string[] = [];
    session.onChange(() => fired.push("changed"));

    await writeFile(docPath, "updated");
    const listener = registered.at(-1)?.listener;
    if (!listener) throw new Error("test bug: watcher listener was not registered");
    listener("change");
    await flushMicrotasks();

    expect(fired).toEqual(["changed"]);
    expect(store.snapshot().documentContent).toBe("updated");
  });

  test("onChange does not fire when the file content is unchanged", async () => {
    const docPath = join(dir, "unchanged.md");
    await writeFile(docPath, "same");
    const store = new SessionStore();
    const { watch, registered } = createFakeWatch();
    const session = createDocumentSession({ store, watch });
    await session.open(docPath);

    const fired: string[] = [];
    session.onChange(() => fired.push("changed"));

    const listener = registered.at(-1)?.listener;
    if (!listener) throw new Error("test bug: watcher listener was not registered");
    listener("change");
    await flushMicrotasks();

    expect(fired).toEqual([]);
  });

  test("onChange ignores non-'change' events", async () => {
    const docPath = join(dir, "rename-event.md");
    await writeFile(docPath, "content");
    const store = new SessionStore();
    const { watch, registered } = createFakeWatch();
    const session = createDocumentSession({ store, watch });
    await session.open(docPath);

    const fired: string[] = [];
    session.onChange(() => fired.push("changed"));

    await writeFile(docPath, "renamed-content");
    const listener = registered.at(-1)?.listener;
    if (!listener) throw new Error("test bug: watcher listener was not registered");
    listener("rename");
    await flushMicrotasks();

    expect(fired).toEqual([]);
  });

  test("close() is idempotent", () => {
    const store = new SessionStore();
    const { watch } = createFakeWatch();
    const session = createDocumentSession({ store, watch });

    expect(() => {
      session.close();
      session.close();
    }).not.toThrow();
  });

  test("save() happy path writes to disk and updates the store", async () => {
    const docPath = join(dir, "save-happy.md");
    await writeFile(docPath, "original");
    const store = new SessionStore();
    const { watch } = createFakeWatch();
    const session = createDocumentSession({ store, watch });
    await session.open(docPath);

    const result = await session.save(docPath, "updated");

    expect(isOk(result)).toBe(true);
    expect(await Bun.file(docPath).text()).toBe("updated");
    expect(store.snapshot().documentContent).toBe("updated");
  });

  test("save() rejects a path that is not the open document", async () => {
    const docPath = join(dir, "save-scope.md");
    const otherPath = join(dir, "save-scope-other.md");
    await writeFile(docPath, "original");
    await writeFile(otherPath, "other");
    const store = new SessionStore();
    const { watch } = createFakeWatch();
    const session = createDocumentSession({ store, watch });
    await session.open(docPath);

    const result = await session.save(otherPath, "hacked");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({ _tag: "DocumentNotOpen", path: otherPath });
    }
    expect(await Bun.file(otherPath).text()).toBe("other");
  });

  test("save() does not trigger onChange via the watcher (no watcher echo)", async () => {
    const docPath = join(dir, "save-no-echo.md");
    await writeFile(docPath, "original");
    const store = new SessionStore();
    const { watch, registered } = createFakeWatch();
    const session = createDocumentSession({ store, watch });
    await session.open(docPath);

    const fired: string[] = [];
    session.onChange(() => fired.push("changed"));

    const result = await session.save(docPath, "saved-content");
    expect(isOk(result)).toBe(true);

    const listener = registered.at(-1)?.listener;
    if (!listener) throw new Error("test bug: watcher listener was not registered");
    listener("change");
    await flushMicrotasks();

    expect(fired).toEqual([]);
  });

  test("save() restores the previous content on write failure", async () => {
    const docPath = join(dir, "save-write-failed.md");
    await writeFile(docPath, "original");
    const store = new SessionStore();
    const { watch } = createFakeWatch();
    const session = createDocumentSession({
      store,
      watch,
      writeFile: () => errAsync({ _tag: "WriteFailed", message: "disk full" }),
    });
    await session.open(docPath);

    const result = await session.save(docPath, "new-content");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({ _tag: "WriteFailed", message: "disk full" });
    }
    expect(store.snapshot().documentContent).toBe("original");
  });
});
