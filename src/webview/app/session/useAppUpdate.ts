import type { AppUpdateState } from "@mdreadr/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReaderApi } from "./reader-api.ts";

export function useAppUpdate(api: ReaderApi) {
  const queryClient = useQueryClient();

  const query = useQuery<AppUpdateState>({
    queryKey: ["app-update"],
    queryFn: () => api.getUpdateStatus(),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "checking" || status === "downloading") {
        return 1000;
      }
      return 60000;
    },
  });

  const checkMutation = useMutation({
    mutationFn: () => api.checkForUpdates(),
    onSuccess: (data) => {
      queryClient.setQueryData(["app-update"], data);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => api.downloadUpdate(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["app-update"] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => api.applyUpdate(),
  });

  return {
    state: query.data ?? { status: "idle", currentVersion: "0.0.0" },
    isLoading: query.isLoading,
    checkForUpdates: checkMutation.mutate,
    isChecking: checkMutation.isPending || query.data?.status === "checking",
    downloadUpdate: downloadMutation.mutate,
    isDownloading: downloadMutation.isPending || query.data?.status === "downloading",
    applyUpdate: applyMutation.mutate,
    isApplying: applyMutation.isPending,
  };
}
