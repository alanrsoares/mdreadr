/**
 * Boots the packaged app and requires it to actually come up.
 *
 * `bun run check` and the Vite bundle step both pass happily on a build that
 * cannot start — a broken native bundle, a missing copied asset, an entrypoint
 * that throws on import. This runs the real artifact from `build/` and waits
 * for the main process to print its ready line, which only happens after the
 * API server is listening and the window has been created.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CHANNEL = "stable";
const READY_LINE = "mdreadr API listening";
const TIMEOUT_MS = 90_000;

function fail(message: string): never {
  console.error(`[smoke] ${message}`);
  process.exit(1);
}

// build/<channel>-<os>-<arch>/ — resolve by prefix rather than recomputing
// electrobun's arch naming, so this keeps working as targets are added.
function findBuildDir(): string {
  if (!existsSync("build")) fail("no build/ directory — run `bun run build` first");

  const dir = readdirSync("build", { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(`${CHANNEL}-`))
    .map((e) => join("build", e.name))
    .sort()
    .at(0);

  return dir ?? fail(`no ${CHANNEL}-* directory under build/`);
}

function findExecutable(buildDir: string): string {
  if (process.platform === "darwin") {
    const app = readdirSync(buildDir).find((n) => n.endsWith(".app"));
    if (!app) fail(`no .app bundle in ${buildDir}`);
    const launcher = join(buildDir, app, "Contents", "MacOS", "launcher");
    if (!existsSync(launcher)) fail(`no launcher at ${launcher}`);
    return launcher;
  }

  const launcher = join(buildDir, "bin", "launcher");
  if (existsSync(launcher)) return launcher;

  // Some Linux layouts nest the bundle one level deeper.
  const nested = readdirSync(buildDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(buildDir, e.name, "bin", "launcher"))
    .find(existsSync);

  return nested ?? fail(`no launcher under ${buildDir}`);
}

type Attempt = { ready: boolean; output: string; exitCode: number | null };

async function launch(executable: string): Promise<Attempt> {
  // WebKitGTK needs an X server and renders blank under the default
  // Wayland/DMABUF path in CI — same env the installer bakes into the desktop
  // entry.
  const useXvfb = process.platform === "linux" && Bun.which("xvfb-run") !== null;
  const command = useXvfb ? ["xvfb-run", "-a", executable] : [executable];

  const child = Bun.spawn(command, {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GDK_BACKEND: "x11", WEBKIT_DISABLE_DMABUF_RENDERER: "1" },
  });

  const chunks: string[] = [];

  // Drain both streams into one buffer so the failure report shows whatever the
  // app managed to say before dying.
  async function drain(stream: ReadableStream<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      const text = decoder.decode(chunk);
      chunks.push(text);
      process.stdout.write(text);
    }
  }

  void drain(child.stdout).catch(() => {});
  void drain(child.stderr).catch(() => {});

  const startedAt = Date.now();
  let ready = false;

  while (Date.now() - startedAt < TIMEOUT_MS) {
    if (chunks.join("").includes(READY_LINE)) {
      ready = true;
      break;
    }
    if (child.exitCode !== null) break;
    await Bun.sleep(500);
  }

  // A process that reaches "ready" and then immediately dies is still a
  // failure, so confirm it is holding steady rather than trusting the log line.
  if (ready) {
    await Bun.sleep(3000);
    if (child.exitCode !== null) {
      ready = false;
      console.error(`[smoke] app started then exited with code ${child.exitCode}`);
    }
  }

  child.kill();
  return { ready, output: chunks.join(""), exitCode: child.exitCode };
}

const buildDir = findBuildDir();
const executable = findExecutable(buildDir);
console.log(`[smoke] launching ${executable}`);

let attempt = await launch(executable);

// The shipped launcher is a self-extractor: on a cold machine — which every CI
// runner is — its first run unpacks the real bundle into the app data folder
// and exits 0 without ever starting the app. That is expected, not a failure.
// The relaunch is the run that has to come up.
if (!attempt.ready && attempt.exitCode === 0) {
  console.log("[smoke] first run self-extracted and exited; relaunching…");
  attempt = await launch(executable);
}

if (!attempt.ready) {
  console.error(`[smoke] ---- captured output ----\n${attempt.output}`);
  fail(`app never reported "${READY_LINE}" (last exit code: ${attempt.exitCode})`);
}

console.log(`[smoke] ok — app started and stayed up (${buildDir})`);
