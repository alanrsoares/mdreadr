import { startServer } from "../packages/api/index.ts";

// Standalone bootstrap for driving the webview against a real API server
// without the Electrobun native shell (no BrowserWindow, no file-picker
// dialogs). Used by the run-mdreadr-ui skill to smoke-test the UI headless.
const { port, url, webviewToken } = startServer(0);

process.stdout.write(`${JSON.stringify({ port, url, webviewToken })}\n`);
