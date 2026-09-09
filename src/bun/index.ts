import * as fs from "node:fs";
import { isErr } from "@onrails/result";
import { ApplicationMenu, app, BrowserWindow, Updater } from "electrobun/main";
import { toDocumentHttpError } from "../../packages/api/documents.ts";
import { documentSession, startServer } from "../../packages/api/index.ts";
import { APP_NAME } from "../../shared/constants.ts";
import { installCliCommand } from "./installCli.ts";
import { checkForUpdatesCommand, checkForUpdatesOnLaunch } from "./updater.ts";

let activeApiBase: string | null = null;
let activeMainWindow: BrowserWindow | null = null;
let pendingOpenUrl: string | null = null;

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
      const response = await fetch(configuredDevServer);
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

  ApplicationMenu.on("application-menu-clicked", (event) => {
    const action = (event as { data?: { action?: string } })?.data?.action;
    if (action === "install-cli") {
      installCliCommand();
    }
    if (action === "check-for-updates") {
      void checkForUpdatesCommand();
    }
    if (action === "edit-undo" || action === "edit-redo") {
      // The bridge is installed by the webview entrypoint; the optional call
      // keeps a menu click harmless if the menu is somehow up before it.
      const method = action === "edit-undo" ? "undo" : "redo";
      activeMainWindow?.webview.executeJavascript(`window.__MDREADR_EDIT__?.${method}()`);
    }
  });

  ApplicationMenu.setApplicationMenu([
    {
      submenu: [
        { label: `About ${APP_NAME}`, role: "about" },
        { type: "separator" },
        { label: "Check for Updates…", action: "check-for-updates" },
        { type: "separator" },
        { label: `Install '${APP_NAME}' Command in PATH`, action: "install-cli" },
        { type: "separator" },
        { label: "Quit", role: "quit", accelerator: "q" },
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
      ],
    },
  ]);
}

async function openArgvDocument(): Promise<void> {
  const markdownArg = process.argv.find((arg) => arg.endsWith(".md") && !arg.startsWith("-"));
  if (!markdownArg) return;

  const result = await documentSession.open(markdownArg);
  if (isErr(result)) {
    console.error(`Failed to open document from argv: ${toDocumentHttpError(result.error).error}`);
  }
}

const { url: apiBase, webviewToken } = startServer();
console.log(`mdreadr API listening on ${apiBase}`);

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

const mainWindow = new BrowserWindow({
  title: APP_NAME,
  url: viewUrl,
  preload: `window.__MDREADR_API__ = ${JSON.stringify(apiBase)}; window.__MDREADR_WEBVIEW_TOKEN__ = ${JSON.stringify(webviewToken)};`,
  frame: {
    width: 1280,
    height: 840,
    x: 100,
    y: 100,
  },
});

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
