import * as fs from "node:fs";
import { ApplicationMenu, app, BrowserWindow } from "electrobun/bun";
import { app as apiApp, startServer } from "../../packages/api/index.ts";
import { APP_NAME } from "../../shared/constants.ts";

let activeApiBase: string | null = null;
let activeMainWindow: BrowserWindow | null = null;
let pendingOpenUrl: string | null = null;

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

  await handleOpenUrl(urlStr, activeApiBase, activeMainWindow);
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

    await handleOpenUrl(urlStr, activeApiBase, activeMainWindow);
  }
};

async function handleOpenUrl(urlStr: string, apiBase: string, mainWindow: BrowserWindow) {
  try {
    const url = new URL(urlStr);
    if (url.protocol === "file:") {
      const decodedPath = decodeURIComponent(url.pathname);
      console.log(`[open-url] Opening document: ${decodedPath}`);

      await apiApp.handle(
        new Request(`${apiBase}/documents/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: decodedPath }),
        }),
      );

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

  ApplicationMenu.setApplicationMenu([
    {
      submenu: [
        { label: `About ${APP_NAME}`, role: "about" },
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

async function openArgvDocument(apiBase: string): Promise<void> {
  const markdownArg = process.argv.find((arg) => arg.endsWith(".md") && !arg.startsWith("-"));
  if (!markdownArg) return;

  await apiApp.handle(
    new Request(`${apiBase}/documents/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: markdownArg }),
    }),
  );
}

const { url: apiBase } = startServer(0);
console.log(`mdreadr API listening on ${apiBase}`);

// If we have a pending open-url from startup, handle it before creating the window
if (pendingOpenUrl) {
  try {
    const url = new URL(pendingOpenUrl);
    if (url.protocol === "file:") {
      const decodedPath = decodeURIComponent(url.pathname);
      console.log(`[startup-open] Opening startup document: ${decodedPath}`);
      await apiApp.handle(
        new Request(`${apiBase}/documents/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: decodedPath }),
        }),
      );
    }
  } catch (e) {
    console.error("Failed to open startup document:", e);
  }
} else {
  await openArgvDocument(apiBase);
}

buildApplicationMenu();

const viewUrl = await getMainViewUrl();

const mainWindow = new BrowserWindow({
  title: APP_NAME,
  url: viewUrl,
  preload: `window.__MDREADR_API__ = ${JSON.stringify(apiBase)};`,
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
  await handleOpenUrl(pendingOpenUrl, apiBase, mainWindow);
}

mainWindow.on("close", () => {
  process.exit(0);
});

mainWindow.webview.on("dom-ready", () => {
  console.log("mdreadr webview ready");
  if (viewUrl.startsWith("http://localhost")) {
    mainWindow.webview.openDevTools();
  }
});

console.log(`${APP_NAME} started`);
