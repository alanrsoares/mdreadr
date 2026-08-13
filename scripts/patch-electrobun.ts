import * as fs from "node:fs";

// electrobun materialises its native bits into a host-specific
// `dist-<os>-<arch>` directory at install time, so the set of paths to patch
// depends on the machine we're running on. Discover them instead of hardcoding
// macos-arm64 — otherwise Intel and Linux builds ship without the patch and
// silently lose file-association open events.
const ROOT = "node_modules/electrobun";

const distDirs = fs.existsSync(ROOT)
  ? fs
      .readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory() && (e.name === "dist" || e.name.startsWith("dist-")))
      .map((e) => `${ROOT}/${e.name}`)
  : [];

const targetFiles = distDirs.flatMap((dir) => [`${dir}/main.js`, `${dir}/npmbin.js`]);

// These patches are regexes against electrobun's compiled output, so an
// upstream refactor makes them silently match nothing. Without this guard the
// script writes the file back unchanged and still prints "Patched
// successfully" — the app then ships with file associations quietly broken.
// Fail the install instead, so a version bump surfaces here and not in a
// user's bug report. `electrobun` is pinned to an exact version in
// package.json for the same reason.
function applyPatch(
  file: string,
  label: string,
  content: string,
  pattern: RegExp,
  replacement: string,
): string {
  const patched = content.replace(pattern, replacement);
  if (patched === content) {
    throw new Error(
      `[patch] ${file}: "${label}" matched nothing. electrobun's output likely changed — ` +
        `re-derive the patch in scripts/patch-electrobun.ts against the pinned version.`,
    );
  }
  return patched;
}

let patchedAny = false;

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue;

  let content = fs.readFileSync(file, "utf8");
  if (content.includes("urlOpenCallback")) {
    console.log(`[patch] ${file} is already patched. Skipping.`);
    patchedAny = true;
    continue;
  }

  // npmbin.js is a thin launcher shim that carries none of the FFI plumbing —
  // only main.js is a real patch target. Skip anything without the anchor.
  if (!content.includes("bun:ffi")) {
    continue;
  }

  // 1. Add JSCallback and CString to bun:ffi imports
  content = applyPatch(
    file,
    "bun:ffi imports",
    content,
    /import\s+{[^}]+}\s+from\s+"bun:ffi";/,
    'import { dlopen, suffix, ptr, toArrayBuffer, JSCallback, CString } from "bun:ffi";',
  );

  // 2. Add setURLOpenHandler to FFI symbol declarations
  content = applyPatch(
    file,
    "setURLOpenHandler symbol",
    content,
    /forceExit:\s*{\s*args:\s*\["i32"\],\s*returns:\s*"void"\s*}/g,
    'forceExit: {\n        args: ["i32"],\n        returns: "void"\n      },\n      setURLOpenHandler: {\n        args: ["function"],\n        returns: "void"\n      }',
  );

  // 3. Capture open-url events on main thread and forward to worker
  content = applyPatch(
    file,
    "worker open-url bridge",
    content,
    /(?:const\s+worker\s*=\s*)?new\s+Worker\(appEntrypointPath,\s*{}\);/g,
    'const worker = new Worker(appEntrypointPath, {});\n  const urlOpenCallback = new JSCallback(\n    (urlPtr) => {\n      try {\n        const url = new CString(urlPtr).toString();\n        worker.postMessage({ type: "open-url", url });\n      } catch (e) {\n        console.error("[LAUNCHER-ERROR]", e);\n      }\n    },\n    { args: ["cstring"], returns: "void" }\n  );\n  lib.symbols.setURLOpenHandler(urlOpenCallback);',
  );

  fs.writeFileSync(file, content, "utf8");
  patchedAny = true;
  console.log(`[patch] Patched ${file} successfully.`);
}

// Zero patch targets means the dist layout moved out from under us — just as
// broken as a regex that stopped matching, and just as silent if unreported.
if (!patchedAny) {
  throw new Error(
    `[patch] found no electrobun launcher to patch under ${ROOT} ` +
      `(looked in: ${distDirs.join(", ") || "no dist dirs"}).`,
  );
}
