import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { WithChildren } from "./types.ts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
    },
  },
});

export const AppProviders = ({ children }: WithChildren) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

export { queryClient };
