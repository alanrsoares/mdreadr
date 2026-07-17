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
      entitlements: {},
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
