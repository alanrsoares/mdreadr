import type { AppUpdateState } from "../domain/index.ts";

export type UpdateHandler = {
  getStatus: () => AppUpdateState;
  check: () => Promise<AppUpdateState>;
  download: () => Promise<void>;
  apply: () => Promise<void>;
};

let defaultHandler: UpdateHandler = {
  getStatus: () => ({
    status: "idle",
    currentVersion: "0.0.0",
  }),
  check: async () => ({
    status: "idle",
    currentVersion: "0.0.0",
  }),
  download: async () => {},
  apply: async () => {},
};

export const updateService = {
  setHandler(handler: UpdateHandler) {
    defaultHandler = handler;
  },
  getStatus(): AppUpdateState {
    return defaultHandler.getStatus();
  },
  check(): Promise<AppUpdateState> {
    return defaultHandler.check();
  },
  download(): Promise<void> {
    return defaultHandler.download();
  },
  apply(): Promise<void> {
    return defaultHandler.apply();
  },
};
