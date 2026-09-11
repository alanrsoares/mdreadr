import * as fs from "node:fs";
import { isErr } from "@onrails/result";
import { ApplicationMenu, app, BrowserWindow, Updater } from "electrobun/main";
import { toDocumentHttpError } from "../../packages/api/documents.ts";
import { documentSession, startServer, updateService } from "../../packages/api/index.ts";
import { loadOpenTabs } from "../../packages/api/open-tabs.ts";
import {
  DEFAULT_WINDOW_FRAME,
  loadWindowFrame,
  saveWindowFrame,
  saveWindowFrameSync,
  type WindowFrame,
} from "../../packages/api/window-state.ts";
import { APP_NAME } from "../../shared/constants.ts";
import { installCliCommand } from "./installCli.ts";
import {
  applyUpdate,
  check,
  checkForUpdatesCommand,
  checkForUpdatesOnLaunch,
  downloadUpdate,
  getUpdateMenuItemConfig,
  getUpdateStatus,
  setMenuUpdateListener,
} from "./updater.ts";

let activeApiBase: string | null = null;
let activeMainWindow: BrowserWindow | null = null;
let pendingOpenUrl: string | null = null;

/** One write per settle: a corner drag emits a resize per frame. */
const WINDOW_FRAME_WRITE_DEBOUNCE_MS = 400;

// Register file change notification to update the webview dynamically
documentSession.onChange((documentId) => {
  if (activeMainWindow) {
    try {
      fs.appendFileSync(
        "/tmp/mdreadr-debug.log",
        `[${new Date().toISOString()}] File change detected for ${documentId}, dispatching open-document event to webview...\n`,
      );
    } catch {}
    activeMainWindow.webview.executeJavascript(
      "window.dispatchEvent(new CustomEvent('mdreadr:open-document'))",
    );
  }
});

// File associations (electrobun.config.ts `app.fileAssociations`) deliver an
// opened document here as a `file://` url, both cold-start and while running.
// Electrobun 1.x had no such delivery to the main process, which is what
// `scripts/patch-electrobun.ts` used to bolt on by patching the launcher's FFI
// bindings; v2 emits the event itself, so the patch and its second
// worker-message channel are both gone.
app.on("open-url", async (data: unknown) => {
  const urlStr = (data as { url?: string })?.url;
  try {
    fs.appendFileSync(
      "/tmp/mdreadr-debug.log",
      `[${new Date().toISOString()}] app.on(open-url) triggered: ${JSON.stringify(data)}\n`,
    );
  } catch {}

  if (!urlStr) return;

  if (!activeApiBase || !activeMainWindow) {
    pendingOpenUrl = urlStr;
    return;
  }

  await handleOpenUrl(urlStr, activeMainWindow);
});

async function handleOpenUrl(urlStr: string, mainWindow: BrowserWindow) {
  try {
    const url = new URL(urlStr);
    if (url.protocol === "file:") {
      const decodedPath = decodeURIComponent(url.pathname);
      console.log(`[open-url] Opening document: ${decodedPath}`);

      const result = await documentSession.open(decodedPath);
      if (isErr(result)) {
        console.error(
          `Failed to open document from open-url: ${toDocumentHttpError(result.error).error}`,
        );
      }

      mainWindow.activate();
      mainWindow.webview.executeJavascript(
        "window.dispatchEvent(new CustomEvent('mdreadr:open-document'))",
      );
    }
  } catch (e) {
    console.error("Failed to handle open-url event:", e);
    try {
      fs.appendFileSync(
        "/tmp/mdreadr-debug.log",
        `[${new Date().toISOString()}] open-url error: ${e instanceof Error ? e.message : String(e)}\n`,
      );
    } catch {}
  }
}

const devServerUrl = (): string | null => {
  const configured = process.env.MDREADR_DEV_SERVER_URL;
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" || !["127.0.0.1", "::1", "localhost"].includes(url.hostname)) {
      console.warn(`Ignoring non-loopback MDREADR_DEV_SERVER_URL: ${configured}`);
      return null;
    }
    return url.href;
  } catch {
    console.warn(`Ignoring invalid MDREADR_DEV_SERVER_URL: ${configured}`);
    return null;
  }
};

// The api base is injected via preload instead of a query string: the macOS
// views:// handler treats the query as part of the ASAR file path and 404s.
async function getMainViewUrl(): Promise<string> {
  try {
    const info = await Updater.getLocalInfo();
    // Production builds (channel: "stable") must never probe or load dev servers
    if (info.channel === "stable") {
      return "views://mainview/index.html";
    }
  } catch {
    // If version info can't be read, continue with dev check fallback
  }

  const configuredDevServer = devServerUrl();
  if (configuredDevServer) {
    try {
      const response = await fetch(configuredDevServer, { redirect: "error" });
      if (response.ok) return configuredDevServer;
    } catch {
      console.warn(`Could not reach MDREADR_DEV_SERVER_URL: ${configuredDevServer}`);
    }
  }

  return "views://mainview/index.html";
}

function buildApplicationMenu(): void {
  if (process.platform === "linux") {
    return;
  }

  const renderMenu = () => {
    ApplicationMenu.setApplicationMenu([
      {
        submenu: [
          { label: `About ${APP_NAME}`, role: "about" },
          { type: "separator" },
          getUpdateMenuItemConfig(),
          { type: "separator" },
          { label: `Install '${APP_NAME}' Command in PATH`, action: "install-cli" },
          { type: "separator" },
          { label: "Quit", role: "quit", accelerator: "q" },
        ],
      },
      {
        label: "File",
        submenu: [
          { label: "Open…", action: "app:open-document", accelerator: "CmdOrCtrl+O" },
          { type: "separator" },
          { label: "Save", action: "app:save-document", accelerator: "CmdOrCtrl+S" },
          { type: "separator" },
          { label: "Close Tab", action: "app:close-tab", accelerator: "CmdOrCtrl+W" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          // Explicit actions rather than the native undo/redo roles — see
          // src/webview/app/editorCommands.ts for why the responder chain is the
          // wrong route here.
          { label: "Undo", action: "edit-undo", accelerator: "CmdOrCtrl+Z" },
          { label: "Redo", action: "edit-redo", accelerator: "CmdOrCtrl+Shift+Z" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
          { type: "separator" },
          { label: "Find…", action: "app:find-in-document", accelerator: "CmdOrCtrl+F" },
        ],
      },
      {
        label: "View",
        submenu: [
          {
            label: "Toggle Preview / Edit",
            action: "app:toggle-view-mode",
            accelerator: "CmdOrCtrl+E",
          },
          { type: "separator" },
          {
            label: "Toggle Navigation",
            action: "app:toggle-navigation-sidebar",
            accelerator: "CmdOrCtrl+1",
          },
          {
            label: "Toggle Notes",
            action: "app:toggle-notes-sidebar",
            accelerator: "CmdOrCtrl+2",
          },
        ],
      },
    ]);
  };

  ApplicationMenu.on("application-menu-clicked", (event) => {
    const action = (event as { data?: { action?: string } })?.data?.action;
    if (action === "install-cli") {
      installCliCommand();
    }
    if (action === "check-for-updates") {
      void checkForUpdatesCommand();
    }
    if (action === "download-update") {
      downloadUpdate().catch((e) => {
        console.error("Failed to download update:", e);
      });
    }
    if (action === "apply-update") {
      applyUpdate().catch((e) => {
        console.error("Failed to apply update:", e);
      });
    }
    // Everything the reader owns rather than the shell: which Tab is in front,
    // whether a sidebar is collapsed, whether the Draft is dirty. The bun
    // process holds none of it, so the menu just names the command.
    if (action?.startsWith("app:")) {
      const command = action.slice("app:".length);
      activeMainWindow?.webview.executeJavascript(
        `window.__MDREADR_APP__?.run(${JSON.stringify(command)})`,
      );
    }
    if (action === "edit-undo" || action === "edit-redo") {
      // The bridge is installed by the webview entrypoint; the optional call
      // keeps a menu click harmless if the menu is somehow up before it.
      const method = action === "edit-undo" ? "undo" : "redo";
      activeMainWindow?.webview.executeJavascript(`window.__MDREADR_EDIT__?.${method}()`);
    }
  });

  setMenuUpdateListener(() => {
    renderMenu();
  });

  renderMenu();
}

/**
 * Persists the window's frame so the next launch opens where this one closed.
 * Resize fires per frame while a corner is dragged, so the write waits for the
 * drag to settle; `close` flushes whatever the last event carried, since the
 * process exits before a pending timer could run.
 */
function rememberWindowFrame(window: BrowserWindow): void {
  let pending: WindowFrame | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (sync = false) => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const frame = pending;
    pending = null;
    if (sync) saveWindowFrameSync(frame);
    else void saveWindowFrame(frame);
  };

  const remember = (event: unknown) => {
    const data = (event as { data?: Partial<WindowFrame> })?.data;
    // `move` carries no size, so the width and height stay whatever the last
    // resize (or the frame the window opened at) reported.
    const current = { ...(pending ?? window.getFrame()), ...data };
    pending = {
      x: current.x,
      y: current.y,
      width: current.width,
      height: current.height,
    };
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, WINDOW_FRAME_WRITE_DEBOUNCE_MS);
  };

  window.on("resize", remember);
  window.on("move", remember);
  window.on("close", () => flush(true));
}

async function openArgvDocument(): Promise<void> {
  const markdownArg = process.argv.find((arg) => arg.endsWith(".md") && !arg.startsWith("-"));
  if (!markdownArg) return;

  const result = await documentSession.open(markdownArg);
  if (isErr(result)) {
    console.error(`Failed to open document from argv: ${toDocumentHttpError(result.error).error}`);
  }
}

/**
 * Reopens last session's Tabs before anything the launch itself asks for, so a
 * Document opened from the command line or a double-clicked file still ends up
 * in front. Each one is a normal open: it gets its watcher and its place in
 * recents, and a file that has since gone is already filtered out.
 */
async function restoreOpenTabs(): Promise<void> {
  const tabs = await loadOpenTabs();
  if (isErr(tabs)) return;

  for (const path of tabs.value.paths) {
    const result = await documentSession.open(path);
    if (isErr(result)) {
      console.error(`Failed to restore tab ${path}: ${toDocumentHttpError(result.error).error}`);
    }
  }
  // Reopening in order leaves the last one active; put the reader back on the
  // one they were actually reading.
  if (tabs.value.activePath) await documentSession.open(tabs.value.activePath);
}

updateService.setHandler({
  getStatus: getUpdateStatus,
  check,
  download: downloadUpdate,
  apply: applyUpdate,
});

const { url: apiBase, webviewToken } = startServer();
console.log(`mdreadr API listening on ${apiBase}`);

await restoreOpenTabs();

// If we have a pending open-url from startup, handle it before creating the window
if (pendingOpenUrl) {
  try {
    const url = new URL(pendingOpenUrl);
    if (url.protocol === "file:") {
      const decodedPath = decodeURIComponent(url.pathname);
      console.log(`[startup-open] Opening startup document: ${decodedPath}`);
      const result = await documentSession.open(decodedPath);
      if (isErr(result)) {
        console.error(
          `Failed to open startup document: ${toDocumentHttpError(result.error).error}`,
        );
      }
    }
  } catch (e) {
    console.error("Failed to open startup document:", e);
  }
} else {
  await openArgvDocument();
}

buildApplicationMenu();

const viewUrl = await getMainViewUrl();

const frameResult = await loadWindowFrame();
const savedFrame = isErr(frameResult) ? { ...DEFAULT_WINDOW_FRAME } : frameResult.value;

const mainWindow = new BrowserWindow({
  title: APP_NAME,
  url: viewUrl,
  preload: `window.__MDREADR_API__ = ${JSON.stringify(apiBase)}; window.__MDREADR_WEBVIEW_TOKEN__ = ${JSON.stringify(webviewToken)};`,
  frame: savedFrame,
});

rememberWindowFrame(mainWindow);

activeApiBase = apiBase;
activeMainWindow = mainWindow;

if (pendingOpenUrl) {
  await handleOpenUrl(pendingOpenUrl, mainWindow);
}

mainWindow.on("close", () => {
  process.exit(0);
});

mainWindow.webview.on("dom-ready", () => {
  console.log("mdreadr webview ready");
  if (process.env.MDREADR_DEVTOOLS === "1") {
    mainWindow.webview.openDevTools();
  }
});

checkForUpdatesOnLaunch();

console.log(`${APP_NAME} started`);
