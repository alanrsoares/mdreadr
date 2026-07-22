import type { ElectrobunConfig } from "electrobun/bun";
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
    useAsar: true,
    bun: {
      entrypoint: "src/bun/index.ts",
      external: [],
    },
    views: {},
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets/": "views/mainview/assets/",
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
    baseUrl: "",
  },
} satisfies ElectrobunConfig;
