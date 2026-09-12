/** The part of Electrobun's `UpdateInfo` that says whether a download landed. */
export type DownloadOutcome = {
  updateReady: boolean;
  error: string;
};

/**
 * Electrobun's `downloadUpdate()` resolves even when it failed — it reports the
 * failure through its status stream and leaves `updateInfo()` holding the
 * error. Taking the resolved promise as success is what let a failed download
 * present itself as "Restart to Update", so the bundle is only ready when the
 * updater itself says it is prepared.
 *
 * `undefined` means the download landed.
 */
export const downloadFailure = (outcome: DownloadOutcome): string | undefined => {
  if (outcome.error) return outcome.error;
  return outcome.updateReady ? undefined : "The update bundle was not prepared";
};
