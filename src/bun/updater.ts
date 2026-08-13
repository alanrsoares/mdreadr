import { resolve } from "node:path";
import { PATHS, Updater, Utils } from "electrobun/bun";
import { APP_NAME } from "../../shared/constants.ts";

// Electrobun disables updates on the "dev" channel and when no release baseUrl
// is configured; both surface as a thrown error or a no-update result rather
// than something we should show the user. Only an explicit menu check reports
// "you're up to date" — the launch check stays quiet unless there's news.
type CheckOutcome =
  | { kind: "available"; version: string }
  | { kind: "up-to-date" }
  | { kind: "unavailable"; reason: string };

async function check(): Promise<CheckOutcome> {
  try {
    const info = await Updater.checkForUpdate();
    if (info.error) return { kind: "unavailable", reason: info.error };
    if (!info.updateAvailable) return { kind: "up-to-date" };
    return { kind: "available", version: info.version };
  } catch (e) {
    return { kind: "unavailable", reason: e instanceof Error ? e.message : String(e) };
  }
}

// Our macOS builds ship unsigned (see electrobun.config.ts) and install.sh
// applies an ad-hoc signature locally. An applied update replaces the bundle
// wholesale, dropping that signature — re-apply it so the *next* launch is not
// at the mercy of however strictly the running macOS enforces signatures.
// Best-effort and fire-and-forget: a failure here never blocks the app.
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

async function downloadAndApply(version: string): Promise<void> {
  const { response } = await Utils.showMessageBox({
    type: "question",
    title: `Update ${APP_NAME}`,
    message: `${APP_NAME} ${version} is available.`,
    detail: "Downloading takes a moment. The app restarts once the update is applied.",
    buttons: ["Download and Install", "Later"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return;

  try {
    await Updater.downloadUpdate();
    resignBundleIfNeeded();
    // applyUpdate swaps the bundle and relaunches on its own, so nothing after
    // this line is guaranteed to run.
    await Updater.applyUpdate();
  } catch (e) {
    await Utils.showMessageBox({
      type: "error",
      title: "Update failed",
      message: `${APP_NAME} could not install the update.`,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Menu-driven check: always reports an outcome, including "up to date". */
export async function checkForUpdatesCommand(): Promise<void> {
  const outcome = await check();

  if (outcome.kind === "available") {
    await downloadAndApply(outcome.version);
    return;
  }

  await Utils.showMessageBox({
    type: outcome.kind === "up-to-date" ? "info" : "error",
    title: `${APP_NAME} updates`,
    message:
      outcome.kind === "up-to-date" ? `${APP_NAME} is up to date.` : "Could not check for updates.",
    detail: outcome.kind === "unavailable" ? outcome.reason : "",
  });
}

/**
 * Launch-time check. Silent unless an update exists, and never throws into the
 * startup path — a broken updater must not stop the app from opening.
 */
export function checkForUpdatesOnLaunch(): void {
  resignBundleIfNeeded();

  void check()
    .then((outcome) => {
      if (outcome.kind !== "available") return;
      Utils.showNotification({
        title: APP_NAME,
        body: `Version ${outcome.version} is available — check for updates to install it.`,
      });
    })
    .catch(() => {});
}
