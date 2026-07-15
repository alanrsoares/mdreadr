import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: path.resolve(__dirname, "src/webview"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@mdreadr/domain": path.resolve(__dirname, "packages/domain/index.ts"),
      "@mdreadr/api": path.resolve(__dirname, "packages/api/index.ts"),
      "@mdreadr/shared/constants": path.resolve(__dirname, "shared/constants.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
