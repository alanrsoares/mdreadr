import { describe, expect, it } from "bun:test";
import { createContainer, storageSet } from "@re-reduced/react";
import { colorSchemeContainer, STORAGE_KEY } from "../theme/color-scheme-container.ts";
import { decodeStored, makeDebouncedStorageInterpreter, type StorageBackend } from "./storage.ts";

function fakeBackend(overrides: Partial<StorageBackend> = {}) {
  const writes: Array<[string, string]> = [];
  const values = new Map<string, string>();
  const backend: StorageBackend & { writes: typeof writes } = {
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push([key, value]);
      values.set(key, value);
    },
    ...overrides,
  };
  return backend;
}

describe("makeDebouncedStorageInterpreter", () => {
  it("coalesces repeated writes to the same key into the last value", async () => {
    const backend = fakeBackend();
    const { interpreter } = makeDebouncedStorageInterpreter({ ms: 5, backend });

    interpreter(storageSet("k", 12));
    interpreter(storageSet("k", 13));
    interpreter(storageSet("k", 14));
    expect(backend.writes).toEqual([]);

    await Bun.sleep(20);
    expect(backend.writes).toEqual([["k", "14"]]);
  });

  it("debounces each key independently", async () => {
    const backend = fakeBackend();
    const { interpreter } = makeDebouncedStorageInterpreter({ ms: 5, backend });

    interpreter(storageSet("a", 1));
    interpreter(storageSet("b", 2));

    await Bun.sleep(20);
    expect(backend.writes.map(([key]) => key).sort()).toEqual(["a", "b"]);
  });

  it("flush writes pending values immediately and only once", async () => {
    const backend = fakeBackend();
    const { interpreter, flush } = makeDebouncedStorageInterpreter({ ms: 50, backend });

    interpreter(storageSet("k", "v"));
    flush();
    expect(backend.writes).toEqual([["k", '"v"']]);

    await Bun.sleep(80);
    expect(backend.writes).toHaveLength(1);
  });

  it("swallows a throwing backend (quota exceeded, private mode)", async () => {
    const backend = fakeBackend({
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    const { interpreter, flush } = makeDebouncedStorageInterpreter({ ms: 1, backend });

    interpreter(storageSet("k", "v"));
    expect(() => flush()).not.toThrow();
  });

  it("is inert when no storage backend exists", () => {
    const { interpreter, flush } = makeDebouncedStorageInterpreter({ ms: 1, backend: null });
    interpreter(storageSet("k", "v"));
    expect(() => flush()).not.toThrow();
  });
});

describe("decodeStored", () => {
  it("decodes JSON payloads", () => {
    expect(decodeStored('"dark"', (raw) => raw)).toBe("dark");
    expect(decodeStored("true", (raw) => raw)).toBe(true);
  });

  it("falls back to the raw string for pre-migration payloads", () => {
    // Written as `localStorage.setItem(key, "dark")`, before storageSet.
    expect(decodeStored("dark", (raw) => raw)).toBe("dark");
    expect(decodeStored("not json {", (raw) => raw)).toBe("not json {");
  });

  it("passes undefined through when nothing is stored", () => {
    expect(decodeStored(null, (raw) => raw)).toBeUndefined();
  });
});

describe("container persistence effects", () => {
  it("writes state changes through the storage interpreter", async () => {
    const backend = fakeBackend();
    const { interpreter } = makeDebouncedStorageInterpreter({ ms: 1, backend });
    const store = createContainer(colorSchemeContainer, {
      interpreters: { storageSet: interpreter },
      init: { colorScheme: "dark" },
    });

    store.actions.colorSchemeChanged("light");
    await Bun.sleep(20);

    expect(backend.writes).toEqual([[STORAGE_KEY, '"light"']]);
    store.destroy();
  });

  it("does not write when the action leaves state unchanged", async () => {
    const backend = fakeBackend();
    const { interpreter } = makeDebouncedStorageInterpreter({ ms: 1, backend });
    const store = createContainer(colorSchemeContainer, {
      interpreters: { storageSet: interpreter },
      init: { colorScheme: "dark" },
    });

    store.actions.colorSchemeChanged("dark");
    await Bun.sleep(20);

    expect(backend.writes).toEqual([]);
    store.destroy();
  });
});
