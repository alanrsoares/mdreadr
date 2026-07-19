import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PATHS, Utils } from "electrobun/bun";
import { APP_NAME } from "../../shared/constants.ts";

const CLI_TARGET_PATH = "/usr/local/bin/mdreadr";

// PATHS.RESOURCES_FOLDER is Contents/Resources inside the .app bundle;
// walking up two levels gives the bundle path itself.
function resolveAppBundlePath(): string | null {
  const appBundlePath = resolve(PATHS.RESOURCES_FOLDER, "..", "..");
  return appBundlePath.endsWith(".app") ? appBundlePath : null;
}

export async function installCliCommand(): Promise<void> {
  if (process.platform === "linux") {
    const launcherPath = resolve(PATHS.RESOURCES_FOLDER, "..", "bin", "launcher");
    const script = `#!/bin/sh\nexport GDK_BACKEND=x11\nexport WEBKIT_DISABLE_DMABUF_RENDERER=1\nexec "${launcherPath}" "$@"\n`;
    const userBinDir = join(process.env.HOME || "~", ".local", "bin");
    const userBinPath = join(userBinDir, "mdreadr");

    try {
      mkdirSync(userBinDir, { recursive: true });
      writeFileSync(userBinPath, script, { mode: 0o755 });
      Utils.showNotification({
        title: APP_NAME,
        body: `Installed '${APP_NAME}' command to ${userBinPath}`,
      });
    } catch (e) {
      await Utils.showMessageBox({
        type: "error",
        title: "Install failed",
        message: `Could not install the '${APP_NAME}' command to ${userBinPath}.`,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
    return;
  }

  if (process.platform !== "darwin") {
    await Utils.showMessageBox({
      type: "error",
      title: "Not supported",
      message: `Installing the '${APP_NAME}' command is only supported on macOS and Linux.`,
    });
    return;
  }

  const appBundlePath = resolveAppBundlePath();
  if (!appBundlePath) {
    await Utils.showMessageBox({
      type: "error",
      title: "Can't install command",
      message: `The '${APP_NAME}' command can only be installed from the packaged app.`,
    });
    return;
  }

  const script = `#!/bin/sh\nexec open -a "${appBundlePath}" "$@"\n`;
  const stagedPath = join(tmpdir(), "mdreadr-cli-install.sh");
  writeFileSync(stagedPath, script, { mode: 0o755 });

  try {
    mkdirSync("/usr/local/bin", { recursive: true });
    copyFileSync(stagedPath, CLI_TARGET_PATH);
    chmodSync(CLI_TARGET_PATH, 0o755);
  } catch {
    // /usr/local/bin isn't writable by the current user — retry with an
    // admin-privileged prompt, same as VS Code's "Install 'code' command".
    const shellCmd = `mkdir -p /usr/local/bin && cp '${stagedPath}' '${CLI_TARGET_PATH}' && chmod +x '${CLI_TARGET_PATH}'`;
    const result = Bun.spawnSync([
      "osascript",
      "-e",
      `do shell script "${shellCmd}" with administrator privileges`,
    ]);
    if (result.exitCode !== 0) {
      await Utils.showMessageBox({
        type: "error",
        title: "Install failed",
        message: `Could not install the '${APP_NAME}' command.`,
        detail: new TextDecoder().decode(result.stderr),
      });
      return;
    }
  }

  Utils.showNotification({
    title: APP_NAME,
    body: `Installed '${APP_NAME}' command to ${CLI_TARGET_PATH}`,
  });
}
