import { ApplicationMenu, BrowserWindow } from "electrobun/bun";
import { startServer } from "../../packages/api/index.ts";
import { APP_NAME } from "../../shared/constants.ts";

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

  await fetch(`${apiBase}/documents/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: markdownArg }),
  });
}

const { url: apiBase } = startServer(0);
console.log(`mdreadr API listening on ${apiBase}`);

buildApplicationMenu();

const mainWindow = new BrowserWindow({
  title: APP_NAME,
  url: await getMainViewUrl(),
  preload: `window.__MDREADR_API__ = ${JSON.stringify(apiBase)};`,
  frame: {
    width: 1280,
    height: 840,
    x: 100,
    y: 100,
  },
});

await openArgvDocument(apiBase);

mainWindow.on("close", () => {
  process.exit(0);
});

mainWindow.webview.on("dom-ready", () => {
  console.log("mdreadr webview ready");
});

console.log(`${APP_NAME} started`);
