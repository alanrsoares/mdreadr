const prefix = "[mdreadr-perf]";

type PendingTiming = { startedAt: number; name: string; detail: Record<string, unknown> };

const pending = new Map<string, PendingTiming>();

const isEnabled = (): boolean => import.meta.env.DEV;

export const beginReaderTiming = (
  key: string,
  name: string,
  detail: Record<string, unknown> = {},
): void => {
  if (!isEnabled()) return;
  pending.set(key, { startedAt: performance.now(), name, detail });
};

export const completeReaderTiming = (key: string, detail: Record<string, unknown> = {}): void => {
  if (!isEnabled()) return;
  const timing = pending.get(key);
  if (!timing) return;
  pending.delete(key);

  const duration = performance.now() - timing.startedAt;
  console.debug(`${prefix} ${timing.name} ${duration.toFixed(1)}ms`, {
    ...timing.detail,
    ...detail,
  });
};

/** Surface browser main-thread stalls in the native dev console when WebKit
 * exposes the Long Tasks API. Unsupported engines simply omit the observer. */
export const installReaderPerformanceObserver = (): void => {
  if (!isEnabled() || typeof PerformanceObserver === "undefined") return;

  try {
    const observer = new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        console.warn(`${prefix} long task ${entry.duration.toFixed(1)}ms`);
      }
    });
    observer.observe({ type: "longtask", buffered: true });
  } catch {
    // WKWebView versions without long-task entries are still useful without it.
  }
};
