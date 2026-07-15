import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { router } from "./router.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
    },
  },
});

export const AppProviders = ({ children }: { children?: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children ?? <RouterProvider router={router} />}
  </QueryClientProvider>
);

export { queryClient };
