import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "./app/theme/mdreadr.css";
import "katex/dist/katex.min.css";
import "./app/tw.css";
import "./app/index.css";

import { Theme } from "@astryxdesign/core/theme";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers.tsx";
import { router } from "./app/router.tsx";
import { mdreadrTheme } from "./app/theme/mdreadr.js";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <Theme theme={mdreadrTheme}>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </Theme>
  </StrictMode>,
);
