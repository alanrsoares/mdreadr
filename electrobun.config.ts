import type { ElectrobunConfig } from "electrobun";
import pkg from "./package.json";
import { APP_IDENTIFIER, APP_NAME } from "./shared/constants.ts";

export default {
  app: {
    name: APP_NAME,
    identifier: APP_IDENTIFIER,
    version: pkg.version,
    fileAssociations: [
      {
        ext: ["md", "markdown"],
        name: "Markdown Document",
        role: "Editor",
      },
    ],
  },
  build: {
    // Cottontail is v2's default main-process runtime; ours is Bun, because the
    // API server is Elysia on `Bun.serve` and the document layer is `Bun.file`
    // and `Bun.spawn`. `electrobun prepare` fetches the matching Bun toolchain
    // and the built bundle ships it.
    mainProcess: "bun",
    bun: {
      entrypoint: "src/bun/index.ts",
      external: [],
    },
    // No trailing slash on a destination: Electrobun 2 fails the build with
    // `UnsafeOutputPath` and says nothing about which path it meant.
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    mac: {
      codesign: false,
      notarize: false,
      bundleCEF: false,
      entitlements: {
        "com.apple.security.files.user-selected.read-write":
          "mdreadr needs access to open and save the markdown files you pick or drag in.",
        "com.apple.security.files.downloads.read-write":
          "mdreadr needs access to markdown files in your Downloads folder.",
        "com.apple.security.files.desktop.read-write":
          "mdreadr needs access to markdown files on your Desktop.",
      },
    },
    linux: {
      bundleCEF: false,
      icon: "icon.png",
    },
    win: {
      bundleCEF: false,
    },
  },
  release: {
    // The updater fetches `<baseUrl>/<channel>-<os>-<arch>-update.json` and the
    // bundle/patch files next to it. GitHub's `releases/latest/download` alias
    // always resolves to the newest published release's assets, which is
    // exactly what release.yml uploads — so there's no separate bucket to host.
    baseUrl: "https://github.com/alanrsoares/mdreadr/releases/latest/download",
  },
} satisfies ElectrobunConfig;
