import type { StorageSetIntent } from "@re-reduced/react";
import { useEffect } from "react";

/**
 * Storage plumbing shared by every persisted container.
 *
 * Containers declare *what* to persist (`effects: (fx) => [fx.onChange(...,
 * (v) => storageSet(KEY, v))]`); this module owns *how* it is written — one
 * debounce, one try/catch, one flush-on-teardown, instead of a hand-rolled
 * watcher component per container.
 */

/** Slider drags and resize handles fire per frame; one write per settle is enough. */
export const STORAGE_WRITE_DEBOUNCE_MS = 200;

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type StorageInterpreter = (intent: StorageSetIntent) => void;

type InterpreterOptions = {
  ms?: number;
  /** Injectable for tests; `null` when no storage exists (SSR, locked-down webview). */
  backend?: StorageBackend | null;
};

function getDefaultBackend(): StorageBackend | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Accessing localStorage itself throws when storage is blocked by policy.
    return null;
  }
}

/**
 * Writes are debounced per key and never throw: a full quota or a private-mode
 * window loses the preference, it does not take the reader down with it.
 */
export function makeDebouncedStorageInterpreter(options: InterpreterOptions = {}): {
  interpreter: StorageInterpreter;
  flush: () => void;
  dispose: () => void;
} {
  const { ms = STORAGE_WRITE_DEBOUNCE_MS, backend = getDefaultBackend() } = options;

  const pending = new Map<string, unknown>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const writeNow = (key: string, value: unknown) => {
    try {
      backend?.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable or full — the in-memory state is still correct.
    }
  };

  const settle = (key: string) => {
    const timer = timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(key);
    pending.delete(key);
  };

  const flush = () => {
    for (const [key, value] of [...pending]) {
      writeNow(key, value);
      settle(key);
    }
  };

  const interpreter: StorageInterpreter = (intent) => {
    pending.set(intent.key, intent.value);
    const existing = timers.get(intent.key);
    if (existing !== undefined) clearTimeout(existing);
    timers.set(
      intent.key,
      setTimeout(() => {
        writeNow(intent.key, intent.value);
        settle(intent.key);
      }, ms),
    );
  };

  // A debounced write can still be in flight when the window goes away.
  const hasWindow = typeof window !== "undefined";
  if (hasWindow) window.addEventListener("pagehide", flush);

  const dispose = () => {
    flush();
    if (hasWindow) window.removeEventListener("pagehide", flush);
  };

  return { interpreter, flush, dispose };
}

/**
 * The interpreter registry every persisted container passes to
 * `createContainerContext`. One module-level instance so the debounce and the
 * `pagehide` flush are shared rather than duplicated per container.
 */
const shared = makeDebouncedStorageInterpreter();

export const storageInterpreters = { storageSet: shared.interpreter };

/** Test seam: force any pending writes out without waiting on the debounce. */
export const flushStorageWrites = shared.flush;

/**
 * Adopt a preference another window just wrote, instead of drifting until
 * reload. `event.key === null` means the whole store was cleared.
 */
export function useStorageSync(key: string, onExternalChange: (raw: string | null) => void) {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return;
      onExternalChange(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, onExternalChange]);
}

/**
 * Reads a persisted value, tolerating both the JSON the interpreter writes and
 * the bare strings written before this migration (`dark`, `true`).
 */
export function decodeStored<T>(stored: string | null, parse: (raw: unknown) => T): T {
  if (stored === null) return parse(undefined);
  try {
    return parse(JSON.parse(stored));
  } catch {
    // Pre-migration payloads were written raw, not JSON-encoded.
    return parse(stored);
  }
}

export function readStoredJson<T>(
  key: string,
  parse: (raw: unknown) => T,
  backend: StorageBackend | null = getDefaultBackend(),
): T {
  try {
    return decodeStored(backend?.getItem(key) ?? null, parse);
  } catch {
    return parse(undefined);
  }
}
