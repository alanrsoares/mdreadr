import * as fs from "node:fs";

const targetFiles = [
  "node_modules/electrobun/dist/main.js",
  "node_modules/electrobun/dist-macos-arm64/npmbin.js",
  "node_modules/electrobun/dist-macos-arm64/main.js",
];

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue;

  let content = fs.readFileSync(file, "utf8");
  if (content.includes("urlOpenCallback")) {
    console.log(`[patch] ${file} is already patched. Skipping.`);
    continue;
  }

  // 1. Add JSCallback and CString to bun:ffi imports
  content = content.replace(
    /import\s+{[^}]+}\s+from\s+"bun:ffi";/,
    'import { dlopen, suffix, ptr, toArrayBuffer, JSCallback, CString } from "bun:ffi";',
  );

  // 2. Add setURLOpenHandler to FFI symbol declarations
  content = content.replace(
    /forceExit:\s*{\s*args:\s*\["i32"\],\s*returns:\s*"void"\s*}/g,
    'forceExit: {\n        args: ["i32"],\n        returns: "void"\n      },\n      setURLOpenHandler: {\n        args: ["function"],\n        returns: "void"\n      }',
  );

  // 3. Capture open-url events on main thread and forward to worker
  content = content.replace(
    /(?:const\s+worker\s*=\s*)?new\s+Worker\(appEntrypointPath,\s*{}\);/g,
    'const worker = new Worker(appEntrypointPath, {});\n  const urlOpenCallback = new JSCallback(\n    (urlPtr) => {\n      try {\n        const url = new CString(urlPtr).toString();\n        worker.postMessage({ type: "open-url", url });\n      } catch (e) {\n        console.error("[LAUNCHER-ERROR]", e);\n      }\n    },\n    { args: ["cstring"], returns: "void" }\n  );\n  lib.symbols.setURLOpenHandler(urlOpenCallback);',
  );

  fs.writeFileSync(file, content, "utf8");
  console.log(`[patch] Patched ${file} successfully.`);
}
