/**
 * Packages the built Linux artifacts into .deb and .rpm bundles using nFPM.
 *
 * Uses the clean runtime bundle from artifacts/stable-linux-*.tar.zst rather than
 * the self-extracting installer stub.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";
import { APP_IDENTIFIER, APP_NAME } from "../shared/constants.ts";

function fail(msg: string): never {
  console.error(`[package-linux] ${msg}`);
  process.exit(1);
}

if (!existsSync("artifacts")) {
  fail("no artifacts/ directory found. Run `bun run build` first.");
}

// Find all linux tar.zst archives (e.g., stable-linux-x64.tar.zst, stable-linux-arm64.tar.zst)
const archives = readdirSync("artifacts").filter(
  (n) => /(^|-)linux-/.test(n) && n.endsWith(".tar.zst"),
);

if (archives.length === 0) {
  fail("no linux *.tar.zst files found in artifacts/");
}

const stagingBase = join(process.cwd(), "build", "linux-packages");
if (existsSync(stagingBase)) {
  rmSync(stagingBase, { recursive: true, force: true });
}
mkdirSync(stagingBase, { recursive: true });

for (const archive of archives) {
  const match = archive.match(/(?:.*-)?linux-(x64|arm64)\.tar\.zst$/);
  if (!match) {
    console.warn(`[package-linux] skipping unrecognized archive format: ${archive}`);
    continue;
  }
  const electrobunArch = match[1];
  const debArch = electrobunArch === "x64" ? "amd64" : "arm64";
  const rpmArch = electrobunArch === "x64" ? "x86_64" : "aarch64";

  console.log(`[package-linux] Processing ${archive} (${electrobunArch})...`);

  const archDir = join(stagingBase, electrobunArch);
  const bundleDir = join(archDir, "bundle");
  mkdirSync(bundleDir, { recursive: true });

  // Decompress .tar.zst into .tar then extract
  const zstBuffer = Bun.file(join("artifacts", archive));
  const decompressedTar = Bun.zstdDecompressSync(new Uint8Array(await zstBuffer.arrayBuffer()));
  const tarPath = join(archDir, "bundle.tar");
  writeFileSync(tarPath, decompressedTar);

  const untar = Bun.spawnSync(["tar", "-xf", tarPath, "-C", bundleDir], { stderr: "inherit" });
  if (!untar.success) {
    fail(`failed to extract ${tarPath} (exit ${untar.exitCode})`);
  }

  // Identify inner application root inside bundle
  const innerDir = readdirSync(bundleDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .find((n) => existsSync(join(bundleDir, n, "bin", "launcher")));

  if (!innerDir) {
    fail(`could not find app directory with bin/launcher inside ${archive}`);
  }

  const appSource = join(bundleDir, innerDir);

  // Create wrapper script
  const launcherScript = `#!/bin/sh
export GDK_BACKEND="\${GDK_BACKEND:-x11}"
export WEBKIT_DISABLE_DMABUF_RENDERER="\${WEBKIT_DISABLE_DMABUF_RENDERER:-1}"
exec /usr/lib/${APP_NAME}/bin/launcher "$@"
`;
  const launcherScriptPath = join(archDir, `${APP_NAME}-wrapper.sh`);
  writeFileSync(launcherScriptPath, launcherScript, { mode: 0o755 });

  // Create desktop file
  const desktopEntry = `[Desktop Entry]
Name=${APP_NAME}
Comment=Desktop markdown reader with anchored notes
Exec=${APP_NAME} %U
Icon=${APP_IDENTIFIER}
Terminal=false
Type=Application
Categories=Office;Utility;TextEditor;
MimeType=text/markdown;text/x-markdown;
`;
  const desktopPath = join(archDir, `${APP_IDENTIFIER}.desktop`);
  writeFileSync(desktopPath, desktopEntry);

  // Generate nfpm config
  const nfpmConfig = `name: "${APP_NAME}"
arch: "${debArch}"
platform: "linux"
version: "v${pkg.version}"
section: "utils"
priority: "optional"
maintainer: "Alan Soares <contact@alanrsoares.dev>"
description: "Desktop markdown reader with anchored notes for human-agent review loops"
vendor: "${APP_NAME}"
homepage: "https://github.com/alanrsoares/mdreadr"
license: "MIT"
contents:
  - src: "${appSource}/"
    dst: "/usr/lib/${APP_NAME}"
  - src: "${launcherScriptPath}"
    dst: "/usr/bin/${APP_NAME}"
    file_info:
      mode: 0755
  - src: "${desktopPath}"
    dst: "/usr/share/applications/${APP_IDENTIFIER}.desktop"
  - src: "${join(process.cwd(), "icon.png")}"
    dst: "/usr/share/icons/hicolor/512x512/apps/${APP_IDENTIFIER}.png"
deb:
  depends:
    - libgtk-3-0 (>= 3.24) | libgtk-3-0t64
    - libwebkit2gtk-4.1-0
    - libayatana-appindicator3-1
    - zenity
rpm:
  arch: "${rpmArch}"
  depends:
    - gtk3
    - webkit2gtk4.1
    - libayatana-appindicator-gtk3
    - zenity
`;

  const configPath = join(archDir, "nfpm.yaml");
  writeFileSync(configPath, nfpmConfig);

  // Check if nfpm is installed
  const hasNfpm = Bun.which("nfpm") !== null;
  if (!hasNfpm) {
    console.log(
      `[package-linux] nfpm not found in PATH; skipping packaging step for ${electrobunArch}.`,
    );
    console.log(`[package-linux] Configuration generated at: ${configPath}`);
    continue;
  }

  // Package deb
  const debOutput = join(process.cwd(), "artifacts", `${APP_NAME}_${pkg.version}_${debArch}.deb`);
  console.log(`[package-linux] Building deb -> ${debOutput}`);
  const debProc = Bun.spawnSync(
    ["nfpm", "package", "-f", configPath, "-p", "deb", "-t", debOutput],
    {
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  if (!debProc.success) {
    fail(`nfpm deb build failed with code ${debProc.exitCode}`);
  }

  // Package rpm
  const rpmOutput = join(process.cwd(), "artifacts", `${APP_NAME}-${pkg.version}-1.${rpmArch}.rpm`);
  console.log(`[package-linux] Building rpm -> ${rpmOutput}`);
  const rpmProc = Bun.spawnSync(
    ["nfpm", "package", "-f", configPath, "-p", "rpm", "-t", rpmOutput],
    {
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  if (!rpmProc.success) {
    fail(`nfpm rpm build failed with code ${rpmProc.exitCode}`);
  }
}

console.log("[package-linux] Packaging preparation / completion finished.");
