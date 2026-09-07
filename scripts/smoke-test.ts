/**
 * Boots the packaged app and requires it to actually come up.
 *
 * `bun run check` and the Vite bundle step both pass happily on a build that
 * cannot start — a broken native bundle, a missing copied asset, an entrypoint
 * that throws on import. This runs the real artifact from `build/` and waits
 * until the app is actually serving on its API port, which only happens after
 * the main process has booted.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_API_PORT } from "../packages/api/default-port.ts";

const CHANNEL = "stable";
const READY_LINE = "mdreadr API listening";
const API_URL = `http://127.0.0.1:${DEFAULT_API_PORT}/`;
const TIMEOUT_MS = 90_000;
const HANDOFF_GRACE_MS = 15_000;

/**
 * The ready line alone is not a usable signal on macOS. On a cold machine the
 * self-extractor installs the bundle, starts the app *without* forwarding its
 * stdout, and then stays alive itself — so the launcher we spawned never exits
 * and never prints anything, while a perfectly healthy app listens behind it.
 * Asking the server whether it is serving works on every platform and on both
 * the cold and warm paths, and proves more than a log line does.
 */
async function isApiUp(): Promise<boolean> {
  try {
    // Any status answers the question: a 404 still means the server replied.
    await fetch(API_URL, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

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

  return unpackLinuxBundle();
}

// On Linux the bundle left in build/ is not runnable: electrobun builds the app
// bundle, tars it, then recreates the same folder as the self-extractor wrapper,
// overwriting bin/launcher with the extractor stub. That stub only works with
// the app archive appended to it — the form shipped in <app>-Setup.tar.gz — so
// running it straight from build/ dies with "Not a valid self-extracting
// installer". The untouched bundle is the tar.zst artifact, so unpack that.
function unpackLinuxBundle(): string {
  if (!existsSync("artifacts")) fail("no artifacts/ directory — run `bun run build` first");

  // Electrobun 2 dropped the channel prefix from some artifact names, so match
  // on the platform part and let the extension do the rest.
  const tarball = readdirSync("artifacts")
    .filter((n) => /(^|-)linux-/.test(n) && n.endsWith(".tar.zst"))
    .sort()
    .at(0);

  if (!tarball) fail(`no ${CHANNEL}-linux-*.tar.zst under artifacts/`);

  const workDir = mkdtempSync(join(tmpdir(), "mdreadr-smoke-"));
  const tarPath = join(workDir, "bundle.tar");
  writeFileSync(tarPath, Bun.zstdDecompressSync(readFileSync(join("artifacts", tarball))));

  const untar = Bun.spawnSync(["tar", "-xf", tarPath, "-C", workDir], { stderr: "inherit" });
  if (!untar.success) fail(`failed to untar ${tarball} (exit ${untar.exitCode})`);

  const launcher = readdirSync(workDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(workDir, e.name, "bin", "launcher"))
    .find(existsSync);

  return launcher ?? fail(`no bin/launcher inside ${tarball}`);
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
    if (chunks.join("").includes(READY_LINE) || (await isApiUp())) {
      ready = true;
      break;
    }
    // The launcher exiting does not mean the app is gone — on macOS it hands
    // off and quits — so keep polling for a grace period before giving up.
    if (child.exitCode !== null && Date.now() - startedAt > HANDOFF_GRACE_MS) break;
    await Bun.sleep(500);
  }

  // Reaching "ready" and then dying is still a failure, so confirm it is
  // holding steady. The app serving is the invariant, not the process we
  // happen to be holding a handle to.
  if (ready) {
    await Bun.sleep(3000);
    if (!(await isApiUp())) {
      ready = false;
      console.error(`[smoke] app came up then stopped serving (exit code ${child.exitCode})`);
    }
  }

  child.kill();
  return { ready, output: chunks.join(""), exitCode: child.exitCode };
}

// Readiness is now "the port answers", so anything already on it would make
// this pass without launching a thing. A stale instance from an earlier run or
// a locally installed copy is the likely culprit, and it is worth naming.
if (await isApiUp()) {
  fail(
    `something is already serving on port ${DEFAULT_API_PORT} — stop it first (\`pkill -f mdreadr\`), otherwise this test proves nothing`,
  );
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

// Killing the launcher does not reap an app it handed off to, which would leave
// the port held for whatever runs next in the same job.
//
// `-sTCP:LISTEN` is not optional: a bare `-iTCP:<port>` also matches the client
// end of a connection, so the readiness polls above put this process in the
// results and the test terminates itself. Skipping our own pid too, belt and
// braces.
function killPortHolder(): void {
  const found = Bun.spawnSync(["lsof", "-nP", "-t", `-iTCP:${DEFAULT_API_PORT}`, "-sTCP:LISTEN"]);

  const pids = found.stdout
    .toString()
    .trim()
    .split("\n")
    .filter((pid) => pid !== "" && pid !== String(process.pid));

  if (pids.length > 0) Bun.spawnSync(["kill", ...pids]);
}

if (!attempt.ready) {
  killPortHolder();
  console.error(`[smoke] ---- captured output ----\n${attempt.output}`);
  fail(`app never came up on port ${DEFAULT_API_PORT} (last exit code: ${attempt.exitCode})`);
}

// Report before tearing down, so the result is on the log even if the teardown
// misbehaves.
console.log(`[smoke] ok — app started and served on ${DEFAULT_API_PORT} (${buildDir})`);
killPortHolder();

// Exit rather than falling off the end. `xvfb-run` is a shell wrapper, so
// killing it leaves the app holding the piped stdout, and the drain loops keep
// the event loop alive forever waiting on a stream that never closes.
process.exit(0);
