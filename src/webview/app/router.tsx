import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { ReaderPage } from "./pages/ReaderPage.tsx";

const rootRoute = createRootRoute({
  component: ReaderPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ReaderPage,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
