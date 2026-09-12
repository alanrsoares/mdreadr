import { resolve } from "node:path";
import { type ApplicationMenuItemConfig, PATHS, Updater, Utils } from "electrobun/main";
import pkg from "../../package.json";
import type { AppUpdateState } from "../../packages/domain/index.ts";
import { APP_NAME } from "../../shared/constants.ts";
import { appendUpdateLog } from "./update-log.ts";
import { downloadFailure } from "./update-outcome.ts";

let currentState: AppUpdateState = {
  status: "idle",
  currentVersion: pkg.version,
};

let onMenuUpdateListener: ((menuItems: ApplicationMenuItemConfig) => void) | null = null;

export function setMenuUpdateListener(
  listener: ((menuItems: ApplicationMenuItemConfig) => void) | null,
) {
  onMenuUpdateListener = listener;
}

export function getUpdateMenuItemConfig(): ApplicationMenuItemConfig {
  switch (currentState.status) {
    case "checking":
      return { label: "Checking for Updates…", enabled: false };
    case "downloading":
      return {
        label: `Downloading Update (${currentState.progressPercent ?? 0}%)…`,
        enabled: false,
      };
    case "ready":
      return {
        label: `Restart to Update to ${currentState.latestVersion ?? "New Version"}…`,
        action: "apply-update",
        enabled: true,
      };
    case "available":
      return {
        label: `Download Update ${currentState.latestVersion ?? ""}…`,
        action: "download-update",
        enabled: true,
      };
    default:
      return {
        label: "Check for Updates…",
        action: "check-for-updates",
        enabled: true,
      };
  }
}

function updateState(next: Partial<AppUpdateState>) {
  currentState = { ...currentState, ...next };
  onMenuUpdateListener?.(getUpdateMenuItemConfig());
}

export function getUpdateStatus(): AppUpdateState {
  return currentState;
}

function resignBundleIfNeeded(): void {
  if (process.platform !== "darwin") return;

  const bundle = resolve(PATHS.RESOURCES_FOLDER, "..", "..");
  if (!bundle.endsWith(".app")) return;

  const verified = Bun.spawnSync(["codesign", "-v", bundle], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (verified.exitCode === 0) return;

  Bun.spawnSync(["codesign", "--force", "--deep", "--sign", "-", bundle], {
    stdio: ["ignore", "ignore", "ignore"],
  });
}

// Hook into Electrobun's real-time state machine
Updater.onStatusChange((entry) => {
  // A shipped launch has no console to print to, and a failed update leaves
  // nothing else behind, so every transition but the progress ticks is logged.
  if (entry.status !== "download-progress") {
    void appendUpdateLog({
      status: entry.status,
      message: entry.message,
      error: entry.details?.errorMessage,
    });
  }

  switch (entry.status) {
    case "checking":
      updateState({ status: "checking", error: undefined });
      break;
    case "no-update":
      updateState({
        status: "up-to-date",
        error: undefined,
        lastCheckedAt: new Date().toISOString(),
      });
      break;
    case "update-available":
      updateState({
        status: "available",
        latestVersion: Updater.updateInfo().version,
        error: undefined,
        lastCheckedAt: new Date().toISOString(),
      });
      break;
    case "downloading":
    case "download-starting":
    case "downloading-patch":
    case "downloading-full-bundle":
      updateState({ status: "downloading", progressPercent: 0 });
      break;
    case "download-progress":
      updateState({
        status: "downloading",
        progressPercent: entry.details?.progress ?? currentState.progressPercent,
        bytesDownloaded: entry.details?.bytesDownloaded,
        totalBytes: entry.details?.totalBytes,
      });
      break;
    case "download-complete":
    case "patch-chain-complete":
      updateState({
        status: "ready",
        progressPercent: 100,
        latestVersion: Updater.updateInfo().version,
      });
      Utils.showNotification({
        title: APP_NAME,
        subtitle: "Update Ready",
        body: `Version ${Updater.updateInfo().version} is ready. Restart to install.`,
      });
      break;
    case "error":
      updateState({
        status: "error",
        error: entry.details?.errorMessage || entry.message,
      });
      break;
  }
});

export async function check(): Promise<AppUpdateState> {
  updateState({ status: "checking", error: undefined });
  try {
    const info = await Updater.checkForUpdate();
    if (info.error) {
      updateState({ status: "error", error: info.error });
      return currentState;
    }
    if (!info.updateAvailable) {
      updateState({
        status: "up-to-date",
        error: undefined,
        lastCheckedAt: new Date().toISOString(),
      });
      return currentState;
    }
    updateState({
      status: "available",
      latestVersion: info.version,
      error: undefined,
      lastCheckedAt: new Date().toISOString(),
    });
    return currentState;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    updateState({ status: "error", error: errorMsg });
    return currentState;
  }
}

export async function downloadUpdate(): Promise<void> {
  updateState({ status: "downloading", progressPercent: 0, error: undefined });
  try {
    await Updater.downloadUpdate();
    const info = Updater.updateInfo();
    const failure = downloadFailure(info);
    if (failure) throw new Error(failure);
    resignBundleIfNeeded();
    updateState({
      status: "ready",
      progressPercent: 100,
      latestVersion: info.version,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    void appendUpdateLog({ status: "download-refused", error: errorMsg });
    updateState({ status: "error", error: errorMsg });
    throw e;
  }
}

export async function applyUpdate(): Promise<void> {
  try {
    resignBundleIfNeeded();
    await Updater.applyUpdate();
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    void appendUpdateLog({ status: "apply-failed", error: errorMsg });
    updateState({ status: "error", error: errorMsg });
    await Utils.showMessageBox({
      type: "error",
      title: "Update failed",
      message: `${APP_NAME} could not install the update.`,
      detail: errorMsg,
    });
    throw e;
  }
}

/** Menu-driven check: always reports an outcome, including "up to date". */
export async function checkForUpdatesCommand(): Promise<void> {
  const result = await check();

  if (result.status === "available" && result.latestVersion) {
    const { response } = await Utils.showMessageBox({
      type: "question",
      title: `Update ${APP_NAME}`,
      message: `${APP_NAME} ${result.latestVersion} is available.`,
      detail: "Downloading takes a moment. The app restarts once the update is applied.",
      buttons: ["Download and Install", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      try {
        await downloadUpdate();
        await applyUpdate();
      } catch (e) {
        await Utils.showMessageBox({
          type: "error",
          title: "Update failed",
          message: `${APP_NAME} could not install the update.`,
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return;
  }

  await Utils.showMessageBox({
    type: result.status === "up-to-date" ? "info" : "error",
    title: `${APP_NAME} updates`,
    message:
      result.status === "up-to-date"
        ? `${APP_NAME} is up to date.`
        : "Could not check for updates.",
    detail: result.status === "error" ? result.error || "" : "",
  });
}

/** Launch-time check. Silent unless an update exists. */
export function checkForUpdatesOnLaunch(): void {
  resignBundleIfNeeded();

  void check()
    .then((state) => {
      if (state.status !== "available" || !state.latestVersion) return;
      Utils.showNotification({
        title: APP_NAME,
        subtitle: `v${state.latestVersion} Available`,
        body: `Version ${state.latestVersion} is available — check for updates to install it.`,
      });
    })
    .catch(() => {});
}
