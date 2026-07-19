import * as fs from "node:fs";
import { isErr } from "@onrails/result";
import { ApplicationMenu, app, BrowserWindow } from "electrobun/bun";
import { toDocumentHttpError } from "../../packages/api/documents.ts";
import { documentSession, startServer } from "../../packages/api/index.ts";
import { APP_NAME } from "../../shared/constants.ts";
import { installCliCommand } from "./installCli.ts";

let activeApiBase: string | null = null;
let activeMainWindow: BrowserWindow | null = null;
let pendingOpenUrl: string | null = null;

// Register file change notification to update the webview dynamically
documentSession.onChange(() => {
  if (activeMainWindow) {
    try {
      fs.appendFileSync(
        "/tmp/mdreadr-debug.log",
        `[${new Date().toISOString()}] File change detected, dispatching open-document event to webview...\n`,
      );
    } catch {}
    activeMainWindow.webview.executeJavascript(
      "window.dispatchEvent(new CustomEvent('mdreadr:open-document'))",
    );
  }
});

// Register the open-url listener for runtime triggers (when app is already running)
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

// Register parent thread message listener for open-url events forwarded by the launcher
// Since these are received as JS string messages, they are immune to FFI memory corruption.
self.onmessage = async (event: MessageEvent) => {
  const data = event.data;
  if (data && data.type === "open-url") {
    const urlStr = data.url;
    try {
      fs.appendFileSync(
        "/tmp/mdreadr-debug.log",
        `[${new Date().toISOString()}] Worker received open-url message: ${urlStr}\n`,
      );
    } catch {}

    if (!urlStr) return;

    if (!activeApiBase || !activeMainWindow) {
      pendingOpenUrl = urlStr;
      return;
    }

    await handleOpenUrl(urlStr, activeMainWindow);
  }
};

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

// The api base is injected via preload instead of a query string: the macOS
// views:// handler treats the query as part of the ASAR file path and 404s.
async function getMainViewUrl(): Promise<string> {
  try {
    const response = await fetch("http://localhost:5173");
    if (response.ok) {
      return "http://localhost:5173/";
    }
  } catch {
    // Vite dev server not running, use bundled views
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
  });

  ApplicationMenu.setApplicationMenu([
    {
      submenu: [
        { label: `About ${APP_NAME}`, role: "about" },
        { type: "separator" },
        { label: `Install '${APP_NAME}' Command in PATH`, action: "install-cli" },
        { type: "separator" },
        { label: "Quit", role: "quit", accelerator: "q" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
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

console.log(`${APP_NAME} started`);
